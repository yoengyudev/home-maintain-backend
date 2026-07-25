import bcrypt from "bcryptjs";
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
            department: user.adminProfile.department ?? null,
            avatarUrl: user.adminProfile.avatarUrl ?? null,
            createdAt: user.createdAt.toISOString(),
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
        if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
        if (data.department !== undefined) updateData.department = data.department;

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

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new BadRequestException(
                lang === "km"
                    ? "ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ។"
                    : "Current password is incorrect."
            );
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

        return { success: true };
    }
}
