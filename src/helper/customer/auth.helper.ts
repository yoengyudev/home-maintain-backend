import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { DevicePlatform, UserRole } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { UnauthorizedException } from "../../utils/app-error.util";

export const hashToken = (token: string): string => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

export const createCustomerSession = async (params: {
    userId: string;
    sessionId: string;
    refreshToken: string;
}) => {
    const { userId, sessionId, refreshToken } = params;

    // Far-future expiry: customer sessions stay valid until logout (revokedAt).
    const NEVER_EXPIRES_AT = new Date("9999-12-31T23:59:59.999Z");

    return prisma.accountSession.create({
        data: {
            publicId: sessionId,
            userId,
            tokenHash: hashToken(refreshToken),
            expiresAt: NEVER_EXPIRES_AT,
        },
    });
};

export const revokeCustomerSession = async (userId: string, sessionId?: string) => {
    if (!sessionId) {
        await prisma.accountSession.updateMany({
            where: {
                userId,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
        return;
    }

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
};

export const assertActiveCustomerSession = async (
    userId: string,
    sessionId: string | undefined,
    lang: Lang
) => {
    if (!sessionId) {
        throw new UnauthorizedException(t("CUSTOMER_SESSION_INVALID", lang));
    }

    const session = await prisma.accountSession.findFirst({
        where: {
            publicId: sessionId,
            userId,
            revokedAt: null,
        },
    });

    if (!session) {
        throw new UnauthorizedException(t("CUSTOMER_SESSION_INVALID", lang));
    }

    await prisma.accountSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
    });
};

export const upsertFcmToken = async (params: {
    userId: string;
    token: string;
    platform?: DevicePlatform;
    deviceName?: string;
}) => {
    const { userId, token, platform, deviceName } = params;

    return prisma.fcmToken.upsert({
        where: { token },
        create: {
            publicId: crypto.randomUUID(),
            userId,
            token,
            platform: platform ?? DevicePlatform.UNKNOWN,
            deviceName,
            isActive: true,
            lastUsedAt: new Date(),
        },
        update: {
            userId,
            platform: platform ?? undefined,
            deviceName: deviceName ?? undefined,
            isActive: true,
            lastUsedAt: new Date(),
        },
    });
};

export const deactivateFcmToken = async (userId: string, token?: string) => {
    if (token) {
        await prisma.fcmToken.updateMany({
            where: { userId, token },
            data: { isActive: false },
        });
        return;
    }

    await prisma.fcmToken.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
    });
};

export const formatCustomerAuthUser = (user: {
    publicId: string;
    email: string;
    phone: string | null;
    role: UserRole;
    customerProfile: unknown;
}) => {
    return {
        publicId: user.publicId,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.customerProfile,
    };
};
