import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../database/prisma.client";
import { hashPassword } from "../../utils/password.util";
import { verifyPassword } from "../../utils/verify-password.util";
import { signCustomerAccessToken, signCustomerRefreshToken } from "../../utils/jwt.util";
import { Env } from "../../config/env.config";
import type { z } from "zod";
import type {
    customerRegisterSchema,
    customerLoginSchema,
    customerVerifyRegisterOtpSchema,
    customerResendRegisterOtpSchema,
    customerForgotPasswordSchema,
    customerVerifyForgotPasswordOtpSchema,
    customerResendForgotPasswordOtpSchema,
    customerResetPasswordSchema,
    customerChangePasswordSchema,
    customerGoogleAuthSchema,
} from "../../validators/customer/auth.validator";
import { AccountStatus, DevicePlatform, UserRole } from "../../generated/prisma/enums";
import { isCustomerRole } from "../../helper/check-role.helper";
import {
    createCustomerSession,
    formatCustomerAuthUser,
    revokeCustomerSession,
    upsertFcmToken,
    deactivateFcmToken,
} from "../../helper/customer/auth.helper";
import { OtpService } from "../otp/otp.service";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { BadRequestException, NotFoundException, UnauthorizedException } from "../../utils/app-error.util";

type GoogleAuthDto = z.infer<typeof customerGoogleAuthSchema>;

type RegisterDto = z.infer<typeof customerRegisterSchema>;
type LoginDto = z.infer<typeof customerLoginSchema>;
type VerifyRegisterOtpDto = z.infer<typeof customerVerifyRegisterOtpSchema>;
type ResendRegisterOtpDto = z.infer<typeof customerResendRegisterOtpSchema>;
type ForgotPasswordDto = z.infer<typeof customerForgotPasswordSchema>;
type VerifyForgotPasswordOtpDto = z.infer<typeof customerVerifyForgotPasswordOtpSchema>;
type ResendForgotPasswordOtpDto = z.infer<typeof customerResendForgotPasswordOtpSchema>;
type ResetPasswordDto = z.infer<typeof customerResetPasswordSchema>;
type ChangePasswordDto = z.infer<typeof customerChangePasswordSchema>;

type PendingCustomerRegistration = {
    fullName: string;
    email: string;
    phone: string;
    passwordHash: string;
    fcmToken: string;
    platform?: DevicePlatform;
    deviceName?: string;
};

type PendingForgotPassword = {
    userId: string;
    phone: string;
};

export class CustomerAuthenticationService {
    static async register(data: RegisterDto, lang: Lang) {
        const { fullName, email, password, phone, fcmToken, platform, deviceName } = data;

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ phone }, { email }],
            },
        });

        if (existingUser) {
            throw new BadRequestException(t("CUSTOMER_PHONE_OR_EMAIL_EXISTS", lang));
        }

        const passwordHash = await hashPassword(password);

        const otpResult = await OtpService.createAndSend<PendingCustomerRegistration>({
            phone,
            purpose: "CUSTOMER_REGISTER",
            payload: {
                fullName,
                email,
                phone,
                passwordHash,
                fcmToken,
                platform,
                deviceName,
            },
        });

        return {
            phone: otpResult.phone,
            expiresIn: otpResult.expiresIn,
            ...(otpResult.debugOtp ? { debugOtp: otpResult.debugOtp } : {}),
        };
    }

    static async verifyRegisterOtp(data: VerifyRegisterOtpDto, lang: Lang) {
        const { phone, otp } = data;

        const pending = OtpService.consume<PendingCustomerRegistration>(
            phone,
            "CUSTOMER_REGISTER",
            otp,
            lang
        );

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ phone: pending.phone }, { email: pending.email }],
            },
        });

        if (existingUser) {
            throw new BadRequestException(t("CUSTOMER_PHONE_OR_EMAIL_EXISTS", lang));
        }

        const result = await prisma.$transaction(async (tx) => {
            return tx.user.create({
                data: {
                    email: pending.email,
                    phone: pending.phone,
                    passwordHash: pending.passwordHash,
                    role: UserRole.CUSTOMER,
                    publicId: crypto.randomUUID(),
                    phoneVerifiedAt: new Date(),
                    customerProfile: {
                        create: {
                            publicId: crypto.randomUUID(),
                            fullName: pending.fullName,
                        },
                    },
                },
                include: {
                    customerProfile: true,
                },
            });
        });

        const sessionId = crypto.randomUUID();
        const tokenPayload = {
            userId: result.id,
            role: result.role,
            sid: sessionId,
        };

        const accessToken = signCustomerAccessToken(tokenPayload);
        const refreshToken = signCustomerRefreshToken(tokenPayload);

        await createCustomerSession({
            userId: result.id,
            sessionId,
            refreshToken,
        });
        await upsertFcmToken({
            userId: result.id,
            token: pending.fcmToken,
            platform: pending.platform,
            deviceName: pending.deviceName,
        });

        return {
            user: formatCustomerAuthUser(result),
            accessToken,
            refreshToken,
        };
    }

    static async resendRegisterOtp(data: ResendRegisterOtpDto, lang: Lang) {
        const { phone } = data;

        const otpResult = await OtpService.resend(phone, "CUSTOMER_REGISTER", lang);

        return {
            phone: otpResult.phone,
            expiresIn: otpResult.expiresIn,
            ...(otpResult.debugOtp ? { debugOtp: otpResult.debugOtp } : {}),
        };
    }

    static async login(data: LoginDto, lang: Lang) {
        const { phone, password, fcmToken, platform, deviceName } = data;

        const user = await prisma.user.findUnique({
            where: { phone },
            include: {
                customerProfile: true,
            },
        });

        if (!user || !isCustomerRole(user.role) || !user.passwordHash) {
            throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("CUSTOMER_ACCOUNT_DISABLED", lang));
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
        }

        const sessionId = crypto.randomUUID();
        const tokenPayload = {
            userId: user.id,
            role: user.role,
            sid: sessionId,
        };

        const accessToken = signCustomerAccessToken(tokenPayload);
        const refreshToken = signCustomerRefreshToken(tokenPayload);

        await createCustomerSession({
            userId: user.id,
            sessionId,
            refreshToken,
        });
        await upsertFcmToken({
            userId: user.id,
            token: fcmToken,
            platform,
            deviceName,
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { lastSignedInAt: new Date() },
        });

        return {
            user: formatCustomerAuthUser(user),
            accessToken,
            refreshToken,
        };
    }

    static async loginWithGoogle(data: GoogleAuthDto, lang: Lang) {
        const { idToken, fcmToken, platform, deviceName } = data;

        const googleClient = new OAuth2Client(Env.GOOGLE_CLIENT_ID);
        let googlePayload: any = null;

        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: Env.GOOGLE_CLIENT_ID,
            });
            googlePayload = ticket.getPayload();
        } catch (err) {
            throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
        }

        if (!googlePayload || !googlePayload.sub) {
            throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
        }

        const googleId = googlePayload.sub;
        const email = (googlePayload.email || "").toLowerCase().trim();
        const fullName = googlePayload.name || "Google User";
        const avatarUrl = googlePayload.picture || null;

        if (!email) {
            throw new BadRequestException("Google account must provide an email address.");
        }

        // 1. Find user by googleId or email
        let user = await prisma.user.findFirst({
            where: {
                OR: [{ googleId }, { email }],
            },
            include: {
                customerProfile: true,
            },
        });

        if (!user) {
            // Register new Customer with Google
            user = await prisma.$transaction(async (tx) => {
                return tx.user.create({
                    data: {
                        email,
                        googleId,
                        role: UserRole.CUSTOMER,
                        accountStatus: AccountStatus.ACTIVE,
                        publicId: crypto.randomUUID(),
                        emailVerifiedAt: new Date(),
                        customerProfile: {
                            create: {
                                publicId: crypto.randomUUID(),
                                fullName,
                                avatarUrl,
                            },
                        },
                    },
                    include: {
                        customerProfile: true,
                    },
                });
            });
        } else {
            // Check role and status
            if (!isCustomerRole(user.role)) {
                throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
            }
            if (user.accountStatus !== AccountStatus.ACTIVE) {
                throw new UnauthorizedException(t("CUSTOMER_ACCOUNT_DISABLED", lang));
            }

            // Link googleId if missing or update profile avatar if empty
            const updates: any = {};
            if (!user.googleId) {
                updates.googleId = googleId;
            }
            if (!user.emailVerifiedAt) {
                updates.emailVerifiedAt = new Date();
            }

            if (Object.keys(updates).length > 0) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: updates,
                    include: { customerProfile: true },
                });
            }

            if (avatarUrl && user.customerProfile && !user.customerProfile.avatarUrl) {
                await prisma.customerProfile.update({
                    where: { id: user.customerProfile.id },
                    data: { avatarUrl },
                });
            }
        }

        const sessionId = crypto.randomUUID();
        const tokenPayload = {
            userId: user.id,
            role: user.role,
            sid: sessionId,
        };

        const accessToken = signCustomerAccessToken(tokenPayload);
        const refreshToken = signCustomerRefreshToken(tokenPayload);

        await createCustomerSession({
            userId: user.id,
            sessionId,
            refreshToken,
        });

        if (fcmToken) {
            await upsertFcmToken({
                userId: user.id,
                token: fcmToken,
                platform,
                deviceName,
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { lastSignedInAt: new Date() },
        });

        return {
            user: formatCustomerAuthUser(user),
            accessToken,
            refreshToken,
        };
    }

    static async loginWithTelegramWidget(data: any, lang: Lang) {
        const botToken = Env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            throw new BadRequestException("Telegram bot is not configured on server.");
        }

        const { hash, fcmToken, platform, deviceName, phone_number, ...telegramData } = data;

        if (!hash) {
            throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
        }

        // 1. Verify HMAC-SHA256 hash as per Telegram official spec
        const dataCheckArr: string[] = [];
        Object.keys(telegramData)
            .sort()
            .forEach((key) => {
                if (telegramData[key] !== undefined && telegramData[key] !== null) {
                    dataCheckArr.push(`${key}=${telegramData[key]}`);
                }
            });
        const dataCheckString = dataCheckArr.join("\n");

        const secretKey = crypto.createHash("sha256").update(botToken).digest();
        const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

        if (calculatedHash !== hash) {
            throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
        }

        // 2. Check auth_date not older than 24 hours
        const authTimestamp = Number(telegramData.auth_date);
        const nowTimestamp = Math.floor(Date.now() / 1000);
        if (nowTimestamp - authTimestamp > 86400) {
            throw new UnauthorizedException("Telegram authentication session has expired.");
        }

        const chatId = String(telegramData.id);
        const firstName = telegramData.first_name || "";
        const lastName = telegramData.last_name || "";
        const username = telegramData.username || null;
        const photoUrl = telegramData.photo_url || null;
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || (username ? `@${username}` : "Telegram User");
        const phone = phone_number || null;

        // 3. Find TelegramAccount or User
        let tgAccount = await prisma.telegramAccount.findUnique({
            where: { chatId },
            include: { user: { include: { customerProfile: true } } },
        });

        let user = tgAccount?.user;

        if (!user) {
            const fallbackEmail = username ? `${username}@telegram.fixithome.internal` : `tg_${chatId}@telegram.fixithome.internal`;

            // Check if phone or email matches existing user
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        ...(phone ? [{ phone }] : []),
                        { email: fallbackEmail },
                    ],
                },
                include: { customerProfile: true },
            });

            if (existingUser) {
                user = existingUser;
                // Create or link TelegramAccount
                await prisma.telegramAccount.upsert({
                    where: { chatId },
                    create: {
                        publicId: crypto.randomUUID(),
                        userId: user.id,
                        chatId,
                        username,
                        firstName,
                        lastName,
                        isConnected: true,
                        connectedAt: new Date(),
                    },
                    update: {
                        userId: user.id,
                        username,
                        firstName,
                        lastName,
                        isConnected: true,
                        connectedAt: new Date(),
                    },
                });
            } else {
                user = await prisma.$transaction(async (tx) => {
                    return tx.user.create({
                        data: {
                            publicId: crypto.randomUUID(),
                            email: fallbackEmail,
                            phone,
                            role: UserRole.CUSTOMER,
                            accountStatus: AccountStatus.ACTIVE,
                            emailVerifiedAt: new Date(),
                            customerProfile: {
                                create: {
                                    publicId: crypto.randomUUID(),
                                    fullName,
                                    avatarUrl: photoUrl,
                                },
                            },
                            telegramAccounts: {
                                create: {
                                    publicId: crypto.randomUUID(),
                                    chatId,
                                    username,
                                    firstName,
                                    lastName,
                                    isConnected: true,
                                    connectedAt: new Date(),
                                },
                            },
                        },
                        include: {
                            customerProfile: true,
                        },
                    });
                });
            }
        } else {
            // Update telegram account details and phone if provided
            await prisma.telegramAccount.update({
                where: { chatId },
                data: {
                    username,
                    firstName,
                    lastName,
                    isConnected: true,
                    connectedAt: new Date(),
                },
            });

            if (phone && !user.phone) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { phone },
                });
            }

            if (photoUrl && user.customerProfile && !user.customerProfile.avatarUrl) {
                await prisma.customerProfile.update({
                    where: { id: user.customerProfile.id },
                    data: { avatarUrl: photoUrl },
                });
            }
        }

        if (!isCustomerRole(user.role)) {
            throw new UnauthorizedException(t("CUSTOMER_INVALID_CREDENTIALS", lang));
        }
        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("CUSTOMER_ACCOUNT_DISABLED", lang));
        }

        const sessionId = crypto.randomUUID();
        const tokenPayload = {
            userId: user.id,
            role: user.role,
            sid: sessionId,
        };

        const accessToken = signCustomerAccessToken(tokenPayload);
        const refreshToken = signCustomerRefreshToken(tokenPayload);

        await createCustomerSession({
            userId: user.id,
            sessionId,
            refreshToken,
        });

        if (fcmToken) {
            await upsertFcmToken({
                userId: user.id,
                token: fcmToken,
                platform,
                deviceName,
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { lastSignedInAt: new Date() },
        });

        return {
            user: formatCustomerAuthUser(user),
            accessToken,
            refreshToken,
        };
    }

    static async logout(userId: string, sessionId?: string) {
        await revokeCustomerSession(userId, sessionId);
        await deactivateFcmToken(userId);
    }

    static async forgotPassword(data: ForgotPasswordDto, lang: Lang) {
        const { phone } = data;

        const user = await prisma.user.findUnique({
            where: { phone },
        });

        if (!user || !isCustomerRole(user.role)) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        const otpResult = await OtpService.createAndSend<PendingForgotPassword>({
            phone,
            purpose: "CUSTOMER_FORGOT_PASSWORD",
            payload: {
                userId: user.id,
                phone,
            },
        });

        return {
            phone: otpResult.phone,
            expiresIn: otpResult.expiresIn,
            ...(otpResult.debugOtp ? { debugOtp: otpResult.debugOtp } : {}),
        };
    }

    static async verifyForgotPasswordOtp(data: VerifyForgotPasswordOtpDto, lang: Lang) {
        const { phone, otp } = data;

        const pending = OtpService.consume<PendingForgotPassword>(
            phone,
            "CUSTOMER_FORGOT_PASSWORD",
            otp,
            lang
        );

        const reset = OtpService.createResetToken<PendingForgotPassword>({
            phone,
            purpose: "CUSTOMER_PASSWORD_RESET",
            payload: pending,
        });

        return {
            phone: reset.phone,
            resetToken: reset.resetToken,
            expiresIn: reset.expiresIn,
        };
    }

    static async resendForgotPasswordOtp(data: ResendForgotPasswordOtpDto, lang: Lang) {
        const { phone } = data;

        const otpResult = await OtpService.resend(phone, "CUSTOMER_FORGOT_PASSWORD", lang);

        return {
            phone: otpResult.phone,
            expiresIn: otpResult.expiresIn,
            ...(otpResult.debugOtp ? { debugOtp: otpResult.debugOtp } : {}),
        };
    }

    static async resetPassword(data: ResetPasswordDto, lang: Lang) {
        const { phone, resetToken, newPassword } = data;

        let pending: PendingForgotPassword;
        try {
            pending = OtpService.consume<PendingForgotPassword>(
                phone,
                "CUSTOMER_PASSWORD_RESET",
                resetToken,
                lang
            );
        } catch {
            throw new BadRequestException(t("CUSTOMER_RESET_TOKEN_INVALID", lang));
        }

        const user = await prisma.user.findUnique({
            where: { id: pending.userId },
        });

        if (!user || !isCustomerRole(user.role) || user.phone !== phone) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        const passwordHash = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        await prisma.accountSession.updateMany({
            where: { userId: user.id },
            data: { revokedAt: new Date() },
        });

        return {
            phone,
        };
    }

    static async changePassword(
        userId: string,
        data: ChangePasswordDto,
        lang: Lang,
        sessionId?: string
    ) {
        const { currentPassword, newPassword } = data;

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || !isCustomerRole(user.role) || !user.passwordHash) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("CUSTOMER_ACCOUNT_DISABLED", lang));
        }

        const isValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isValid) {
            throw new BadRequestException(t("CUSTOMER_PASSWORD_CURRENT_INVALID", lang));
        }

        const passwordHash = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        // Keep the current session; revoke every other device.
        await prisma.accountSession.updateMany({
            where: {
                userId: user.id,
                revokedAt: null,
                ...(sessionId ? { NOT: { publicId: sessionId } } : {}),
            },
            data: { revokedAt: new Date() },
        });

        return { success: true as const };
    }

    static async deleteAccount(userId: string, lang: Lang) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { customerProfile: true },
        });

        if (!user || !isCustomerRole(user.role)) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        if (user.accountStatus === AccountStatus.DISABLED) {
            throw new BadRequestException(t("CUSTOMER_ACCOUNT_DISABLED", lang));
        }

        const anonymizedEmail = `deleted+${user.publicId}@deleted.local`;

        await prisma.$transaction(async (tx) => {
            await tx.accountSession.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });

            await tx.fcmToken.updateMany({
                where: { userId: user.id, isActive: true },
                data: { isActive: false },
            });

            if (user.customerProfile) {
                await tx.customerProfile.update({
                    where: { id: user.customerProfile.id },
                    data: {
                        fullName: "Deleted User",
                        avatarUrl: null,
                        suspendedAt: new Date(),
                    },
                });
            }

            await tx.user.update({
                where: { id: user.id },
                data: {
                    accountStatus: AccountStatus.DISABLED,
                    passwordHash: null,
                    email: anonymizedEmail,
                    phone: null,
                    emailVerifiedAt: null,
                    phoneVerifiedAt: null,
                },
            });
        });

        return { success: true as const };
    }
}
