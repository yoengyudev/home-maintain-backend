import bcrypt from "bcrypt";
import { prisma } from "../../database/prisma.client";
import { NotFoundException, BadRequestException } from "../../utils/app-error.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

export class AdminProfileService {
    static async getProfile(userId: string, lang: Lang) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                adminProfile: true,
            },
        });
        if (!user || !user.adminProfile) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

        return {
            id: user.adminProfile.id,
            publicId: user.adminProfile.publicId,
            fullName: user.adminProfile.fullName,
            email: user.email,
            phone: user.phone ?? null,
            jobTitle: user.adminProfile.jobTitle ?? null,
            department: user.adminProfile.jobTitle ?? null,
            avatarUrl: user.adminProfile.avatarUrl ?? null,
            createdAt: user.createdAt.toISOString(),
            lastSignedInAt: user.lastSignedInAt?.toISOString() ?? null,
        };
    }

    static async updateProfile(
        userId: string,
        data: { fullName?: string; phone?: string; jobTitle?: string; department?: string },
        lang: Lang
    ) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { adminProfile: true },
        });
        if (!user || !user.adminProfile) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));

        const updateData: Record<string, any> = {};
        if (data.fullName) updateData.fullName = data.fullName;
        if (data.jobTitle !== undefined || data.department !== undefined) {
            updateData.jobTitle = data.jobTitle ?? data.department;
        }

        await Promise.all([
            Object.keys(updateData).length > 0
                ? prisma.adminProfile.update({ where: { id: user.adminProfile.id }, data: updateData })
                : Promise.resolve(),
            data.phone !== undefined
                ? prisma.user.update({ where: { id: userId }, data: { phone: data.phone } })
                : Promise.resolve(),
        ]);

        return this.getProfile(userId, lang);
    }

    static async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
        lang: Lang
    ) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (!user.passwordHash) {
            throw new BadRequestException(t("ADMIN_PASSWORD_NOT_SET", lang));
        }

        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            throw new BadRequestException(t("ADMIN_PASSWORD_CURRENT_INVALID", lang));
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashed } });

        return { success: true };
    }
}
