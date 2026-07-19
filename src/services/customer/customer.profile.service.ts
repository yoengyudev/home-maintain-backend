import { prisma } from "../../database/prisma.client";
import { isCustomerRole } from "../../helper/check-role.helper";
import { formatCustomerAuthUser } from "../../helper/customer/auth.helper";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    BadRequestException,
    InternalServerException,
    NotFoundException,
} from "../../utils/app-error.util";
import {
    CUSTOMER_PROFILE_IMAGE_FOLDER,
    destroyCloudinaryImageByUrl,
    uploadImageBuffer,
} from "../../utils/cloudinary.util";
import type { z } from "zod";
import type { customerUpdateProfileSchema } from "../../validators/customer/profile.validator";

type UpdateProfileDto = z.infer<typeof customerUpdateProfileSchema>;

export class CustomerProfileService {
    static async getProfile(userId: string, lang: Lang) {
        const user = await this.findCustomerOrThrow(userId, lang);
        return this.formatProfile(user);
    }

    static async updateProfile(
        userId: string,
        data: UpdateProfileDto,
        avatarFile: Express.Multer.File | undefined,
        lang: Lang
    ) {
        const user = await this.findCustomerOrThrow(userId, lang);

        if (!user.customerProfile) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        const hasTextUpdates =
            data.fullName !== undefined ||
            data.email !== undefined ||
            data.phone !== undefined;
        const hasAvatarUpload = Boolean(avatarFile?.buffer?.length);
        const shouldRemoveAvatar = data.removeAvatar === true && !hasAvatarUpload;

        if (!hasTextUpdates && !hasAvatarUpload && !shouldRemoveAvatar) {
            throw new BadRequestException(t("CUSTOMER_PROFILE_NO_UPDATABLE_FIELDS", lang));
        }

        if (data.email && data.email !== user.email) {
            const existingEmail = await prisma.user.findFirst({
                where: {
                    email: data.email,
                    NOT: { id: userId },
                },
            });

            if (existingEmail) {
                throw new BadRequestException(t("CUSTOMER_PHONE_OR_EMAIL_EXISTS", lang));
            }
        }

        if (data.phone && data.phone !== user.phone) {
            const existingPhone = await prisma.user.findFirst({
                where: {
                    phone: data.phone,
                    NOT: { id: userId },
                },
            });

            if (existingPhone) {
                throw new BadRequestException(t("CUSTOMER_PHONE_OR_EMAIL_EXISTS", lang));
            }
        }

        const phoneChanged = data.phone !== undefined && data.phone !== user.phone;
        const previousAvatarUrl = user.customerProfile.avatarUrl;
        let nextAvatarUrl: string | null | undefined;

        if (hasAvatarUpload && avatarFile?.buffer) {
            nextAvatarUrl = await this.uploadAvatar(avatarFile.buffer, lang);
        } else if (shouldRemoveAvatar) {
            nextAvatarUrl = null;
        }

        const updatedUser = await prisma.$transaction(async (tx) => {
            await tx.customerProfile.update({
                where: { userId },
                data: {
                    ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
                    ...(nextAvatarUrl !== undefined ? { avatarUrl: nextAvatarUrl } : {}),
                },
            });

            return tx.user.update({
                where: { id: userId },
                data: {
                    ...(data.email !== undefined ? { email: data.email } : {}),
                    ...(data.phone !== undefined
                        ? {
                              phone: data.phone,
                              ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
                          }
                        : {}),
                },
                include: {
                    customerProfile: true,
                    preference: true,
                },
            });
        });

        if (nextAvatarUrl !== undefined && previousAvatarUrl) {
            await destroyCloudinaryImageByUrl(previousAvatarUrl);
        }

        return this.formatProfile(updatedUser);
    }

    private static async uploadAvatar(fileBuffer: Buffer, lang: Lang) {
        try {
            const uploaded = await uploadImageBuffer(fileBuffer, CUSTOMER_PROFILE_IMAGE_FOLDER);
            return uploaded.secure_url;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            const maybeObj = err as { message?: string; http_code?: number } | null;
            console.error("[cloudinary] upload failed:", message, maybeObj?.http_code);

            if (
                message.includes("Invalid Signature") ||
                message.includes("Invalid API Key") ||
                maybeObj?.http_code === 401
            ) {
                throw new InternalServerException(t("CLOUDINARY_INVALID_CREDENTIALS", lang));
            }

            throw new InternalServerException(t("IMAGE_UPLOAD_FAILED", lang));
        }
    }

    private static async findCustomerOrThrow(userId: string, lang: Lang) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                customerProfile: true,
                preference: true,
            },
        });

        if (!user || !isCustomerRole(user.role)) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        return user;
    }

    private static formatProfile(user: {
        publicId: string;
        email: string;
        phone: string | null;
        role: Parameters<typeof formatCustomerAuthUser>[0]["role"];
        accountStatus: string;
        emailVerifiedAt: Date | null;
        phoneVerifiedAt: Date | null;
        lastSignedInAt: Date | null;
        customerProfile: unknown;
        preference: unknown;
    }) {
        return {
            ...formatCustomerAuthUser(user),
            accountStatus: user.accountStatus,
            emailVerifiedAt: user.emailVerifiedAt,
            phoneVerifiedAt: user.phoneVerifiedAt,
            lastSignedInAt: user.lastSignedInAt,
            preference: user.preference,
        };
    }
}
