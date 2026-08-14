import { prisma } from "../database/prisma.client";
import { BadRequestException } from "./app-error.util";
import type { Lang } from "../i18n/messages";
import { t } from "../i18n/translate";

/**
 * Resolve catalog tokens (id / publicId / slug / name) to service area ids.
 */
export async function resolveServiceAreaIds(
    tokens: string[] | undefined,
    lang: Lang = "en",
    options?: { requireNonEmpty?: boolean }
): Promise<string[]> {
    const cleaned = [...new Set((tokens || []).map((v) => v.trim()).filter(Boolean))];
    if (cleaned.length === 0) {
        if (options?.requireNonEmpty) {
            throw new BadRequestException(t("VENDOR_INVALID_SERVICE_AREAS", lang));
        }
        return [];
    }

    const areas = await prisma.serviceArea.findMany({
        where: {
            isActive: true,
            OR: cleaned.flatMap((token) => [
                { id: token },
                { publicId: token },
                { slug: token },
                { nameEn: { equals: token, mode: "insensitive" } },
                { nameKm: token },
            ]),
        },
        select: { id: true },
    });

    const ids = [...new Set(areas.map((a) => a.id))];
    if (ids.length === 0 && cleaned.length > 0) {
        throw new BadRequestException(t("VENDOR_INVALID_SERVICE_AREAS", lang));
    }

    return ids;
}

/**
 * Replace a provider's multi service areas and keep primaryAreaId in sync (first id).
 */
export async function syncProviderServiceAreas(
    providerProfileId: string,
    serviceAreaIds: string[]
) {
    const uniqueIds = [...new Set(serviceAreaIds.filter(Boolean))];

    await prisma.$transaction(async (tx) => {
        await tx.providerServiceArea.deleteMany({ where: { providerProfileId } });
        if (uniqueIds.length > 0) {
            await tx.providerServiceArea.createMany({
                data: uniqueIds.map((serviceAreaId) => ({
                    providerProfileId,
                    serviceAreaId,
                })),
                skipDuplicates: true,
            });
        }
        await tx.providerProfile.update({
            where: { id: providerProfileId },
            data: { primaryAreaId: uniqueIds[0] ?? null },
        });
    });

    return uniqueIds;
}

export function toAreaGeoNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}
