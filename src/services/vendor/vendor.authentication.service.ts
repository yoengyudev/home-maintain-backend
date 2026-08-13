import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { hashPassword } from "../../utils/password.util";
import { verifyPassword } from "../../utils/verify-password.util";
import { signAccessToken, signRefreshToken, getRefreshTokenExpiresAt, verifyRefreshToken } from "../../utils/jwt.util";
import { BadRequestException, NotFoundException, UnauthorizedException } from "../../utils/app-error.util";
import type { z } from "zod";
import type { vendorRegisterSchema, vendorLoginSchema, forgotPasswordSchema, resetPasswordSchema, vendorChangePasswordSchema, vendorDeleteAccountSchema, vendorRefreshTokenSchema } from "../../validators/vendor/vendor.auth.validator";
import { normalizeCambodiaPhone } from "../../validators/phone.validate";
import { UserRole, ProviderStatus, AccountStatus, BookingStatus, ServiceStatus } from "../../generated/prisma/enums";
import { deactivateFcmToken, upsertFcmToken } from "../../helper/customer/auth.helper";
import { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

type RegisterDto = z.infer<typeof vendorRegisterSchema>;
type LoginDto = z.infer<typeof vendorLoginSchema>;
type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
type ChangePasswordDto = z.infer<typeof vendorChangePasswordSchema>;
type DeleteAccountDto = z.infer<typeof vendorDeleteAccountSchema>;
type RefreshTokenDto = z.infer<typeof vendorRefreshTokenSchema>;

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
    BookingStatus.PENDING,
    BookingStatus.ACCEPTED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.RESCHEDULED,
];

type SessionMeta = {
    userAgent?: string | null;
    ipAddress?: string | null;
};

const isMobileDevice = (value?: string | null) =>
    /iphone|ipad|ipod|android|mobile/i.test(value ?? "");

export class VendorAuthenticationService {
    static async register(data: RegisterDto, lang: Lang = "en") {
        const { businessName, email, password, contactName, phone } = data;
        const normalizedPhone = normalizeCambodiaPhone(phone);

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { phone: normalizedPhone },
                    ...(email ? [{ email }] : [])
                ]
            }
        });

        if (existingUser) {
            throw new BadRequestException(t("VENDOR_PHONE_OR_EMAIL_EXISTS", lang));
        }

        const hashedPassword = await hashPassword(password);
        const publicId = crypto.randomUUID();

        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: email ?? `${normalizedPhone.replace("+", "")}@provider.local`,
                    phone: normalizedPhone,
                    passwordHash: hashedPassword,
                    role: UserRole.PROVIDER,
                    publicId,
                    providerProfile: {
                        create: {
                            publicId: crypto.randomUUID(),
                            contactName,
                            status: ProviderStatus.PENDING_VERIFICATION,
                            businessProfile: {
                                create: {
                                    businessName
                                }
                            }
                        }
                    }
                },
                include: {
                    providerProfile: {
                        include: {
                            businessProfile: true
                        }
                    }
                }
            });

            return user;
        });

        const sessionId = crypto.randomUUID();
        const tokenPayload = {
            userId: result.id,
            role: result.role,
            sid: sessionId,
        };

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);

        // Store session
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await prisma.accountSession.create({
            data: {
                publicId: sessionId,
                userId: result.id,
                tokenHash,
                expiresAt: getRefreshTokenExpiresAt()
            }
        });

        return {
            user: {
                publicId: result.publicId,
                email: result.email,
                phone: result.phone,
                role: result.role,
                profile: result.providerProfile
            },
            accessToken,
            refreshToken
        };
    }

    static async login(data: LoginDto, lang: Lang = "en", meta: SessionMeta = {}) {
        const { phone, password, fcmToken, platform, deviceName } = data;
        const normalizedPhone = normalizeCambodiaPhone(phone);

        const user = await prisma.user.findUnique({
            where: { phone: normalizedPhone },
            include: { 
                providerProfile: {
                    include: {
                        businessProfile: true
                    }
                }
            }
        });

        if (!user || user.role !== UserRole.PROVIDER || !user.passwordHash) {
            throw new UnauthorizedException(t("VENDOR_INVALID_CREDENTIALS", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("VENDOR_ACCOUNT_DISABLED", lang));
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException(t("VENDOR_INVALID_CREDENTIALS", lang));
        }

        const sessionId = crypto.randomUUID();
        const tokenPayload = {
            userId: user.id,
            role: user.role,
            sid: sessionId,
        };

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);

        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await prisma.accountSession.create({
            data: {
                publicId: sessionId,
                userId: user.id,
                tokenHash,
                deviceName: deviceName || meta.userAgent || null,
                userAgent: meta.userAgent || null,
                ipAddress: meta.ipAddress || null,
                lastUsedAt: new Date(),
                expiresAt: getRefreshTokenExpiresAt()
            }
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
            user: {
                publicId: user.publicId,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.providerProfile
            },
            accessToken,
            refreshToken
        };
    }

    static async refresh(data: RefreshTokenDto, lang: Lang = "en") {
        const { refreshToken } = data;
        const decoded = verifyRefreshToken(refreshToken) as {
            userId?: string;
            role?: UserRole;
            sid?: string;
        } | null;

        if (!decoded?.userId || !decoded?.sid || decoded.role !== UserRole.PROVIDER) {
            throw new UnauthorizedException(t("VENDOR_SESSION_INVALID", lang));
        }

        const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        const session = await prisma.accountSession.findFirst({
            where: {
                publicId: decoded.sid,
                userId: decoded.userId,
                tokenHash,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        if (!session) {
            throw new UnauthorizedException(t("VENDOR_SESSION_INVALID", lang));
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                providerProfile: {
                    include: {
                        businessProfile: true,
                    },
                },
            },
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new UnauthorizedException(t("VENDOR_SESSION_INVALID", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("VENDOR_ACCOUNT_DISABLED", lang));
        }

        const tokenPayload = {
            userId: user.id,
            role: user.role,
            sid: session.publicId,
        };

        const nextAccessToken = signAccessToken(tokenPayload);
        const nextRefreshToken = signRefreshToken(tokenPayload);
        const nextTokenHash = crypto.createHash("sha256").update(nextRefreshToken).digest("hex");

        await prisma.accountSession.update({
            where: { id: session.id },
            data: {
                tokenHash: nextTokenHash,
                lastUsedAt: new Date(),
                expiresAt: getRefreshTokenExpiresAt(),
            },
        });

        return {
            user: {
                publicId: user.publicId,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.providerProfile,
            },
            accessToken: nextAccessToken,
            refreshToken: nextRefreshToken,
        };
    }

    static async forgotPassword(data: ForgotPasswordDto, lang: Lang = "en") {
        const { phone } = data;
        const normalizedPhone = normalizeCambodiaPhone(phone);

        const user = await prisma.user.findUnique({
            where: { phone: normalizedPhone }
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            // We shouldn't throw error to prevent user enumeration, but for simplicity:
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        // Mock sending OTP
        const otp = "123456";
        
        return {
            message: t("VENDOR_OTP_SENT_TO_PHONE", lang),
            phone
        };
    }

    static async resetPassword(data: ResetPasswordDto, lang: Lang = "en") {
        const { phone, otp, newPassword } = data;
        const normalizedPhone = normalizeCambodiaPhone(phone);

        // Mock verification
        if (otp !== "123456") {
            throw new BadRequestException(t("VENDOR_INVALID_VERIFICATION_CODE", lang));
        }

        const user = await prisma.user.findUnique({
            where: { phone: normalizedPhone }
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword }
        });

        // Optionally revoke all existing sessions to force re-login
        await prisma.accountSession.updateMany({
            where: { userId: user.id },
            data: { revokedAt: new Date() }
        });

        return {
            message: t("VENDOR_PASSWORD_RESET_SUCCESSFULLY", lang)
        };
    }

    static async logout(userId: string, sessionId?: string) {
        if (sessionId) {
            await prisma.accountSession.updateMany({
                where: {
                    userId,
                    publicId: sessionId,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
            });
        }

        await deactivateFcmToken(userId);
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

        if (!user || user.role !== UserRole.PROVIDER || !user.passwordHash) {
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("VENDOR_ACCOUNT_DISABLED", lang));
        }

        const isValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isValid) {
            throw new BadRequestException(t("VENDOR_PASSWORD_CURRENT_INVALID", lang));
        }

        if (currentPassword === newPassword) {
            throw new BadRequestException(t("VENDOR_PASSWORD_UNCHANGED", lang));
        }

        const passwordHash = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        let keepSessionId = sessionId;
        if (!keepSessionId) {
            const latest = await prisma.accountSession.findFirst({
                where: {
                    userId: user.id,
                    revokedAt: null,
                    expiresAt: { gt: new Date() },
                },
                orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
            });
            keepSessionId = latest?.publicId;
        }

        await prisma.accountSession.updateMany({
            where: {
                userId: user.id,
                revokedAt: null,
                ...(keepSessionId ? { NOT: { publicId: keepSessionId } } : {}),
            },
            data: { revokedAt: new Date() },
        });

        return { success: true as const };
    }

    static async listSessions(userId: string, lang: Lang, sessionId?: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        const now = new Date();
        const rows = await prisma.accountSession.findMany({
            where: {
                userId,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
        });

        const currentId = sessionId || rows[0]?.publicId;

        return {
            phone: user.phone,
            email: user.email,
            lastSignedInAt: user.lastSignedInAt,
            sessions: rows.map((session) => {
                const label = session.deviceName || session.userAgent || null;
                return {
                    publicId: session.publicId,
                    deviceName: label,
                    ipAddress: session.ipAddress,
                    lastUsedAt: session.lastUsedAt ?? session.createdAt,
                    createdAt: session.createdAt,
                    isCurrent: Boolean(currentId && session.publicId === currentId),
                    isMobile: isMobileDevice(label),
                };
            }),
        };
    }

    static async revokeOtherSessions(userId: string, lang: Lang, sessionId?: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        let keepSessionId = sessionId;
        if (!keepSessionId) {
            const latest = await prisma.accountSession.findFirst({
                where: {
                    userId,
                    revokedAt: null,
                    expiresAt: { gt: new Date() },
                },
                orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
            });
            keepSessionId = latest?.publicId;
        }

        await prisma.accountSession.updateMany({
            where: {
                userId,
                revokedAt: null,
                ...(keepSessionId ? { NOT: { publicId: keepSessionId } } : {}),
            },
            data: { revokedAt: new Date() },
        });

        return this.listSessions(userId, lang, keepSessionId);
    }

    static async deleteAccount(
        userId: string,
        data: DeleteAccountDto,
        lang: Lang
    ) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { providerProfile: true },
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        if (user.accountStatus === AccountStatus.DISABLED) {
            throw new BadRequestException(t("VENDOR_ACCOUNT_DISABLED", lang));
        }

        if (!user.passwordHash) {
            throw new UnauthorizedException(t("VENDOR_INVALID_CREDENTIALS", lang));
        }

        const isValid = await verifyPassword(data.password, user.passwordHash);
        if (!isValid) {
            throw new BadRequestException(t("VENDOR_PASSWORD_CURRENT_INVALID", lang));
        }

        if (user.providerProfile) {
            const activeBookings = await prisma.booking.count({
                where: {
                    providerProfileId: user.providerProfile.id,
                    status: { in: ACTIVE_BOOKING_STATUSES },
                },
            });

            if (activeBookings > 0) {
                throw new BadRequestException(t("VENDOR_ACCOUNT_HAS_ACTIVE_BOOKINGS", lang));
            }
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

            if (user.providerProfile) {
                await tx.serviceListing.updateMany({
                    where: { providerProfileId: user.providerProfile.id },
                    data: { serviceStatus: ServiceStatus.DISABLED },
                });

                await tx.providerProfile.update({
                    where: { id: user.providerProfile.id },
                    data: {
                        status: ProviderStatus.DISABLED,
                        suspendedAt: new Date(),
                        suspensionReason: "Account deleted by provider",
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

    static async me(userId: string, lang: Lang = "en") {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { 
                providerProfile: {
                    include: {
                        businessProfile: true,
                        primaryArea: {
                            select: {
                                publicId: true,
                                nameEn: true,
                                nameKm: true,
                            },
                        },
                    }
                } 
            }
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        return {
            publicId: user.publicId,
            email: user.email,
            phone: user.phone,
            role: user.role,
            profile: user.providerProfile
        };
    }

    static async updateProfile(userId: string, data: {
        businessName?: string;
        providerType?: string;
        contactName?: string;
        addressLine?: string;
        district?: string;
        cityProvince?: string;
        about?: string;
        logoUrl?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        coverageSummary?: string;
        detectedAddress?: string;
        serviceAreaIds?: string[];
    }, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: { businessProfile: true }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        let primaryAreaId: string | null | undefined;
        if (data.serviceAreaIds !== undefined) {
            const tokens = data.serviceAreaIds.filter(Boolean);
            if (tokens.length > 0) {
                const areas = await prisma.serviceArea.findMany({
                    where: {
                        OR: tokens.flatMap((token) => [
                            { id: token },
                            { publicId: token },
                            { slug: token },
                        ]),
                    },
                });
                primaryAreaId = areas[0]?.id ?? null;
            } else {
                primaryAreaId = null;
            }
        }

        const businessData = {
            ...(data.businessName !== undefined && { businessName: data.businessName }),
            ...(data.providerType !== undefined && { providerType: data.providerType }),
            ...(data.addressLine !== undefined && { addressLine: data.addressLine }),
            ...(data.district !== undefined && { district: data.district }),
            ...(data.cityProvince !== undefined && { cityProvince: data.cityProvince }),
            ...(data.about !== undefined && { description: data.about }),
            ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
            ...(data.latitude !== undefined && { latitude: data.latitude }),
            ...(data.longitude !== undefined && { longitude: data.longitude }),
            ...(data.coverageSummary !== undefined && { coverageSummary: data.coverageSummary }),
            ...(data.detectedAddress !== undefined && { detectedAddress: data.detectedAddress }),
        };

        // Update business profile
        if (providerProfile.businessProfile) {
            await prisma.providerBusinessProfile.update({
                where: { id: providerProfile.businessProfile.id },
                data: businessData
            });
        } else if (Object.keys(businessData).length > 0) {
            await prisma.providerBusinessProfile.create({
                data: {
                    providerProfileId: providerProfile.id,
                    businessName: data.businessName || 'Business',
                    ...businessData,
                }
            });
        }

        // Update provider profile
        await prisma.providerProfile.update({
            where: { id: providerProfile.id },
            data: {
                ...(data.contactName !== undefined && { contactName: data.contactName }),
                ...(data.serviceAreaIds !== undefined && {
                    primaryAreaId: primaryAreaId || null,
                }),
            }
        });

        // Return updated profile
        return this.me(userId, lang);
    }

    static async updateAvailability(userId: string, data: {
        workingDays?: string[];
        workingHours?: Record<string, { start: string; end: string }[]>;
        workingHoursStart?: string;
        workingHoursEnd?: string;
        unavailableDates?: string[];
        temporaryPause?: boolean;
        status?: string;
    }, lang: Lang = "en") {
        const providerProfile = await prisma.providerProfile.findUnique({
            where: { userId },
            include: { businessProfile: true }
        });

        if (!providerProfile) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }

        if (providerProfile.businessProfile) {
            let workingHours = data.workingHours;
            if (!workingHours && (data.workingHoursStart || data.workingHoursEnd)) {
                const days = data.workingDays?.length
                    ? data.workingDays
                    : providerProfile.businessProfile.workingDays;
                const start = data.workingHoursStart ?? "08:00";
                const end = data.workingHoursEnd ?? "18:00";
                workingHours = Object.fromEntries(
                    days.map((day) => [day, [{ start, end }]])
                );
            }

            await prisma.providerBusinessProfile.update({
                where: { id: providerProfile.businessProfile.id },
                data: {
                    ...(data.workingDays && { workingDays: data.workingDays }),
                    ...(workingHours && { workingHours }),
                    ...(data.unavailableDates && { unavailableDates: data.unavailableDates.map(d => new Date(d)) }),
                    ...(data.temporaryPause !== undefined && { temporarilyPaused: data.temporaryPause })
                }
            });
        }

        return {
            success: true,
            message: t("VENDOR_AVAILABILITY_UPDATED", lang)
        };
    }
}
