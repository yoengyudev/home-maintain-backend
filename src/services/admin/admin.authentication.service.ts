import { prisma } from "../../database/prisma.client";
import { verifyPassword } from "../../utils/verify-password.util";
import { signAccessToken } from "../../utils/jwt.util";
import { BadRequestException, UnauthorizedException } from "../../utils/app-error.util";
import { AccountStatus, UserRole } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

export class AdminAuthenticationService {
    static async login(email: string, password: string, lang: Lang) {
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
            throw new UnauthorizedException(t("UNAUTHORIZED", lang));
        }

        if (user.accountStatus !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(t("UNAUTHORIZED", lang));
        }

        const isPasswordValid = await verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException(t("UNAUTHORIZED", lang));
        }

        // Update last sign-in timestamp
        await prisma.user.update({
            where: { id: user.id },
            data: { lastSignedInAt: new Date() },
        });

        // Log the sign-in to audit log
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

        const token = signAccessToken({
            userId: user.id,
            role: user.role,
        });

        return {
            token,
            user: {
                id: user.id,
                publicId: user.publicId,
                email: user.email,
                fullName: user.adminProfile?.fullName ?? "",
                avatarUrl: user.adminProfile?.avatarUrl ?? null,
                jobTitle: user.adminProfile?.jobTitle ?? null,
                role: user.role,
            },
        };
    }

    static async logout(userId: string, lang: Lang) {
        const user = await prisma.user.findFirst({
            where: { id: userId, role: UserRole.ADMIN },
            include: { adminProfile: true },
        });

        if (!user) {
            throw new UnauthorizedException(t("UNAUTHORIZED", lang));
        }

        // Log the sign-out
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

        return {
            id: user.id,
            publicId: user.publicId,
            email: user.email,
            fullName: user.adminProfile.fullName,
            avatarUrl: user.adminProfile.avatarUrl,
            jobTitle: user.adminProfile.jobTitle,
            role: user.role,
        };
    }
}
