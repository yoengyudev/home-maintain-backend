import { prisma } from "../../database/prisma.client";
import {
    BadRequestException,
    InternalServerException,
    NotFoundException,
} from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    CATEGORY_IMAGE_FOLDER,
    destroyCloudinaryImageByUrl,
    uploadImageBuffer,
} from "../../utils/cloudinary.util";

type CategoriesQuery = { page?: unknown; limit?: unknown; isActive?: unknown };

type CategoryBody = {
    nameEn?: string;
    nameKm?: string;
    descriptionEn?: string;
    descriptionKm?: string;
    iconName?: string;
    isActive?: boolean | string;
};

function formatCategory(c: any, counts: { providers: number; services: number }) {
    return {
        id: c.id,
        publicId: c.publicId,
        nameEn: c.nameEn,
        nameKm: c.nameKm,
        slug: c.slug,
        descriptionEn: c.descriptionEn,
        descriptionKm: c.descriptionKm,
        iconName: c.iconName,
        isActive: c.isActive,
        providerCount: counts.providers,
        serviceCount: counts.services,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
    };
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") return true;
        if (normalized === "false" || normalized === "0") return false;
    }
    return undefined;
}

function toSlug(nameEn: string) {
    return nameEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export class AdminCategoriesService {
    static async list(query: CategoriesQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);

        const isActiveRaw = query.isActive;
        const isActiveFilter =
            isActiveRaw === "true"
                ? true
                : isActiveRaw === "false"
                ? false
                : undefined;

        const where: any = isActiveFilter !== undefined ? { isActive: isActiveFilter } : {};

        const [categories, total] = await Promise.all([
            prisma.serviceCategory.findMany({
                where,
                orderBy: { nameEn: "asc" },
                skip,
                take,
            }),
            prisma.serviceCategory.count({ where }),
        ]);

        const categoryIds = categories.map((c) => c.id);

        const [providerCounts, serviceCounts] = await Promise.all([
            prisma.providerProfile.groupBy({
                by: ["primaryCategoryId"],
                where: { primaryCategoryId: { in: categoryIds } },
                _count: { id: true },
            }),
            prisma.serviceListing.groupBy({
                by: ["categoryId"],
                where: { categoryId: { in: categoryIds } },
                _count: { id: true },
            }),
        ]);

        const providerMap = new Map(
            providerCounts.map((r) => [r.primaryCategoryId, r._count.id])
        );
        const serviceMap = new Map(
            serviceCounts.map((r) => [r.categoryId, r._count.id])
        );

        return {
            items: categories.map((c) =>
                formatCategory(c, {
                    providers: providerMap.get(c.id) ?? 0,
                    services: serviceMap.get(c.id) ?? 0,
                })
            ),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const c = await prisma.serviceCategory.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!c) throw new NotFoundException(t("ADMIN_CATEGORY_NOT_FOUND", lang));

        const [providers, services] = await Promise.all([
            prisma.providerProfile.count({ where: { primaryCategoryId: c.id } }),
            prisma.serviceListing.count({ where: { categoryId: c.id } }),
        ]);

        return formatCategory(c, { providers, services });
    }

    static async create(
        data: CategoryBody,
        imageFile: Express.Multer.File | undefined,
        adminUserId: string,
        lang: Lang
    ) {
        const nameEn = data.nameEn?.trim();
        const nameKm = data.nameKm?.trim();
        if (!nameEn || !nameKm) {
            throw new BadRequestException(t("ERROR_BAD_REQUEST", lang));
        }

        let iconName = typeof data.iconName === "string" ? data.iconName.trim() || undefined : undefined;
        if (imageFile?.buffer) {
            iconName = await this.uploadCategoryImage(imageFile.buffer, lang);
        }

        const category = await prisma.serviceCategory.create({
            data: {
                publicId: `CAT-${Date.now()}`,
                nameEn,
                nameKm,
                slug: toSlug(nameEn),
                descriptionEn: data.descriptionEn,
                descriptionKm: data.descriptionKm,
                iconName,
                isActive: parseOptionalBoolean(data.isActive) ?? true,
            },
        });

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "CREATED",
                    severity: "INFO",
                    actionEn: `Created category: ${category.nameEn}`,
                    relatedModule: "Categories",
                    relatedRecordId: category.publicId,
                },
            });
        }

        return formatCategory(category, { providers: 0, services: 0 });
    }

    static async update(
        id: string,
        data: CategoryBody,
        imageFile: Express.Multer.File | undefined,
        _adminUserId: string,
        lang: Lang
    ) {
        const c = await prisma.serviceCategory.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!c) throw new NotFoundException(t("ADMIN_CATEGORY_NOT_FOUND", lang));

        const previousIconName = c.iconName;
        let nextIconName: string | null | undefined;

        if (imageFile?.buffer) {
            nextIconName = await this.uploadCategoryImage(imageFile.buffer, lang);
        } else if (data.iconName !== undefined) {
            const trimmed = typeof data.iconName === "string" ? data.iconName.trim() : "";
            nextIconName = trimmed.length > 0 ? trimmed : null;
        }

        const nameEn = data.nameEn?.trim();
        const isActive = parseOptionalBoolean(data.isActive);

        const updated = await prisma.serviceCategory.update({
            where: { id: c.id },
            data: {
                ...(nameEn ? { nameEn, slug: toSlug(nameEn) } : {}),
                ...(data.nameKm !== undefined ? { nameKm: data.nameKm.trim() } : {}),
                ...(data.descriptionEn !== undefined ? { descriptionEn: data.descriptionEn } : {}),
                ...(data.descriptionKm !== undefined ? { descriptionKm: data.descriptionKm } : {}),
                ...(nextIconName !== undefined ? { iconName: nextIconName } : {}),
                ...(isActive !== undefined ? { isActive } : {}),
            },
        });

        if (nextIconName !== undefined && previousIconName && previousIconName !== nextIconName) {
            await destroyCloudinaryImageByUrl(previousIconName);
        }

        return this.getById(updated.id, lang);
    }

    static async disable(id: string, adminUserId: string, lang: Lang) {
        const c = await prisma.serviceCategory.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!c) throw new NotFoundException(t("ADMIN_CATEGORY_NOT_FOUND", lang));

        const updated = await prisma.serviceCategory.update({
            where: { id: c.id },
            data: { isActive: false },
        });

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "DISABLED",
                    severity: "WARNING",
                    actionEn: `Disabled category: ${c.nameEn}`,
                    relatedModule: "Categories",
                    relatedRecordId: c.publicId,
                },
            });
        }

        return this.getById(updated.id, lang);
    }

    static async restore(id: string, adminUserId: string, lang: Lang) {
        const c = await prisma.serviceCategory.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!c) throw new NotFoundException(t("ADMIN_CATEGORY_NOT_FOUND", lang));

        const updated = await prisma.serviceCategory.update({
            where: { id: c.id },
            data: { isActive: true },
        });

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "RESTORED",
                    severity: "INFO",
                    actionEn: `Restored category: ${c.nameEn}`,
                    relatedModule: "Categories",
                    relatedRecordId: c.publicId,
                },
            });
        }

        return this.getById(updated.id, lang);
    }

    static async delete(id: string, adminUserId: string, lang: Lang) {
        const c = await prisma.serviceCategory.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!c) throw new NotFoundException(t("ADMIN_CATEGORY_NOT_FOUND", lang));

        const [providerCount, serviceCount] = await Promise.all([
            prisma.providerProfile.count({ where: { primaryCategoryId: c.id } }),
            prisma.serviceListing.count({ where: { categoryId: c.id } }),
        ]);

        if (providerCount > 0 || serviceCount > 0) {
            throw new BadRequestException(
                t("ADMIN_CATEGORY_DELETE_HAS_LINKS", lang, {
                    providers: providerCount,
                    services: serviceCount,
                })
            );
        }

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "DISABLED",
                    severity: "CRITICAL",
                    actionEn: `Deleted category: ${c.nameEn}`,
                    relatedModule: "Categories",
                    relatedRecordId: c.publicId,
                },
            });
        }

        await prisma.serviceCategory.delete({ where: { id: c.id } });
        await destroyCloudinaryImageByUrl(c.iconName);
        return { deleted: true, id: c.publicId };
    }

    private static async uploadCategoryImage(fileBuffer: Buffer, lang: Lang) {
        try {
            const uploaded = await uploadImageBuffer(fileBuffer, CATEGORY_IMAGE_FOLDER);
            return uploaded.secure_url;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            const maybeObj = err as { message?: string; http_code?: number } | null;
            console.error("[cloudinary] category upload failed:", message, maybeObj?.http_code);

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
}
