import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { hashPassword } from "../../utils/password.util";
import { verifyPassword } from "../../utils/verify-password.util";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.util";
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
} from "../../validators/customer/auth.validator";
import { DevicePlatform, UserRole } from "../../generated/prisma/enums";
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

type RegisterDto = z.infer<typeof customerRegisterSchema>;
type LoginDto = z.infer<typeof customerLoginSchema>;
type VerifyRegisterOtpDto = z.infer<typeof customerVerifyRegisterOtpSchema>;
type ResendRegisterOtpDto = z.infer<typeof customerResendRegisterOtpSchema>;
type ForgotPasswordDto = z.infer<typeof customerForgotPasswordSchema>;
type VerifyForgotPasswordOtpDto = z.infer<typeof customerVerifyForgotPasswordOtpSchema>;
type ResendForgotPasswordOtpDto = z.infer<typeof customerResendForgotPasswordOtpSchema>;
type ResetPasswordDto = z.infer<typeof customerResetPasswordSchema>;

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

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);

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

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);

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
}
