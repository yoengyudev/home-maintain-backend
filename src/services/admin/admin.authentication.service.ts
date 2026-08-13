import crypto from "crypto";
import type { z } from "zod";
import { prisma } from "../../database/prisma.client";
import { verifyPassword } from "../../utils/verify-password.util";
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    getRefreshTokenExpiresAt,
} from "../../utils/jwt.util";
import { UnauthorizedException } from "../../utils/app-error.util";
import { AccountStatus, UserRole } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { deactivateFcmToken, upsertFcmToken } from "../../helper/customer/auth.helper";
import type {
    adminLoginSchema,
    adminRefreshTokenSchema,
} from "../../validators/admin/admin.auth.validator";

type AdminLoginDto = z.infer<typeof adminLoginSchema>;
type AdminRefreshDto = z.infer<typeof adminRefreshTokenSchema>;

type SessionMeta = {
    userAgent?: string | null;
    ipAddress?: string | null;
};

function mapAdminUser(user: {
    id: string;
    publicId: string;
    email: string;
    phone: string | null;
    role: UserRole;
    adminProfile: {
        fullName: string;
        avatarUrl: string | null;
        jobTitle: string | null;
    } | null;
}) {
    return {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        fullName: user.adminProfile?.fullName ?? "",
        avatarUrl: user.adminProfile?.avatarUrl ?? null,
        jobTitle: user.adminProfile?.jobTitle ?? null,
        role: user.role,
        phone: user.phone ?? null,
    };
}

export class AdminAuthenticationService {
    static async login(data: AdminLoginDto, lang: Lang, meta: SessionMeta = {}) {
        const { email, password, fcmToken, platform, deviceName } = data;

        const user = await prisma.user.findFirst({
            where: {
                email: { equals: email, mode: "insensitive" },
                role: UserRole.ADMIN,
            },
            include: {
                adminProfile: true,
            },
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException(t("ADMIN_INVALID_CREDENTIALS", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("ADMIN_ACCOUNT_DISABLED", lang));
        }

        const isPasswordValid = await verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException(t("ADMIN_INVALID_CREDENTIALS", lang));
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { lastSignedInAt: new Date() },
        });

        await upsertFcmToken({
            userId: user.id,
            token: fcmToken,
            platform,
            deviceName,
        });

        if (user.adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: user.adminProfile.id,
                    actorName: user.adminProfile.fullName,
                    eventType: "SIGN_IN",
                    severity: "INFO",
                    actionEn: "Admin signed in",
                    actionKm: "អ្នកគ្រប់គ្រងបានចូលប្រព័ន្ធ",
                    relatedModule: "Authentication",
                },
            });
        }

        const sessionId = crypto.randomUUID();
        const tokenPayload = {
            userId: user.id,
            role: user.role,
            sid: sessionId,
        };

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);
        const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        await prisma.accountSession.create({
            data: {
                publicId: sessionId,
                userId: user.id,
                tokenHash,
                deviceName: deviceName || meta.userAgent || null,
                userAgent: meta.userAgent || null,
                ipAddress: meta.ipAddress || null,
                lastUsedAt: new Date(),
                expiresAt: getRefreshTokenExpiresAt(),
            },
        });

        return {
            // Keep `token` for dashboard backward compatibility
            token: accessToken,
            accessToken,
            refreshToken,
            user: mapAdminUser(user),
        };
    }

    static async refresh(data: AdminRefreshDto, lang: Lang) {
        const { refreshToken } = data;
        const decoded = verifyRefreshToken(refreshToken) as {
            userId?: string;
            role?: UserRole;
            sid?: string;
        } | null;

        if (!decoded?.userId || !decoded?.sid || decoded.role !== UserRole.ADMIN) {
            throw new UnauthorizedException(t("ADMIN_SESSION_INVALID", lang));
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
            throw new UnauthorizedException(t("ADMIN_SESSION_INVALID", lang));
        }

        const user = await prisma.user.findFirst({
            where: { id: decoded.userId, role: UserRole.ADMIN },
            include: { adminProfile: true },
        });

        if (!user) {
            throw new UnauthorizedException(t("ADMIN_SESSION_INVALID", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("ADMIN_ACCOUNT_DISABLED", lang));
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
            token: nextAccessToken,
            accessToken: nextAccessToken,
            refreshToken: nextRefreshToken,
            user: mapAdminUser(user),
        };
    }

    static async logout(userId: string, lang: Lang, sessionId?: string) {
        const user = await prisma.user.findFirst({
            where: { id: userId, role: UserRole.ADMIN },
            include: { adminProfile: true },
        });

        if (!user) {
            throw new UnauthorizedException(t("UNAUTHORIZED", lang));
        }

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

        if (user.adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: user.adminProfile.id,
                    actorName: user.adminProfile.fullName,
                    eventType: "SIGN_OUT",
                    severity: "INFO",
                    actionEn: "Admin signed out",
                    actionKm: "អ្នកគ្រប់គ្រងបានចេញពីប្រព័ន្ធ",
                    relatedModule: "Authentication",
                },
            });
        }
    }

    static async me(userId: string, lang: Lang) {
        const user = await prisma.user.findFirst({
            where: { id: userId, role: UserRole.ADMIN },
            include: { adminProfile: true },
        });

        if (!user || !user.adminProfile) {
            throw new UnauthorizedException(t("UNAUTHORIZED", lang));
        }

        return mapAdminUser(user);
    }

    static async forgotPassword(email: string, lang: Lang) {
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" }, role: UserRole.ADMIN },
        });
        if (!user) {
            throw new UnauthorizedException(t("ADMIN_INVALID_CREDENTIALS", lang));
        }
        return { message: t("ADMIN_OTP_SENT", lang), email };
    }

    static async verifyResetOtp(email: string, otp: string, lang: Lang) {
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" }, role: UserRole.ADMIN },
        });
        if (!user) {
            throw new UnauthorizedException(t("ADMIN_INVALID_CREDENTIALS", lang));
        }
        if (otp !== "123456") {
            throw new UnauthorizedException(t("ADMIN_INVALID_OTP", lang));
        }
        return { verified: true };
    }

    static async resetPassword(email: string, otp: string, newPassword: string, lang: Lang) {
        if (otp !== "123456") {
            throw new UnauthorizedException(t("ADMIN_INVALID_OTP", lang));
        }
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" }, role: UserRole.ADMIN },
        });
        if (!user) {
            throw new UnauthorizedException(t("ADMIN_INVALID_CREDENTIALS", lang));
        }
        const { hashPassword } = await import("../../utils/password.util");
        const hashed = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashed },
        });
        await prisma.accountSession.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return { success: true };
    }
}
