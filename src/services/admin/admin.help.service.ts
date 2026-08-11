import { prisma } from "../../database/prisma.client";
import {
    AuditEventType,
    AuditSeverity,
    FaqAudience,
    SupportPageKey,
    SupportRequestStatus,
} from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";

type FaqBody = {
    audience?: FaqAudience;
    category?: string;
    questionEn?: string;
    questionKm?: string;
    answerEn?: string;
    answerKm?: string;
    keywords?: string[];
    relatedRoute?: string | null;
    relatedRouteLabelEn?: string | null;
    relatedRouteLabelKm?: string | null;
    sortOrder?: number;
    isActive?: boolean;
};

type SupportPageBody = {
    contentEn?: Record<string, unknown>;
    contentKm?: Record<string, unknown>;
    isActive?: boolean;
};

function parseAudience(value: unknown): FaqAudience | undefined {
    const raw = firstQueryString(value)?.toUpperCase();
    if (raw === "CUSTOMER" || raw === "PROVIDER") return raw;
    return undefined;
}

function parseStatus(value: unknown): SupportRequestStatus | undefined {
    const raw = firstQueryString(value)?.toUpperCase();
    if (raw === "OPEN" || raw === "IN_PROGRESS" || raw === "RESOLVED") return raw;
    return undefined;
}

function parsePageKey(value: string): SupportPageKey | undefined {
    const raw = value.trim().toUpperCase();
    if (raw === "ABOUT" || raw === "MISSION" || raw === "PROVIDER_CONTACT") return raw;
    return undefined;
}

function emptyToNull(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
}

function formatFaq(faq: {
    id: string;
    publicId: string;
    audience: FaqAudience;
    category: string;
    questionEn: string;
    questionKm: string;
    answerEn: string;
    answerKm: string;
    keywords: string[];
    relatedRoute: string | null;
    relatedRouteLabelEn: string | null;
    relatedRouteLabelKm: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: faq.id,
        publicId: faq.publicId,
        audience: faq.audience,
        category: faq.category,
        questionEn: faq.questionEn,
        questionKm: faq.questionKm,
        answerEn: faq.answerEn,
        answerKm: faq.answerKm,
        keywords: faq.keywords,
        relatedRoute: faq.relatedRoute,
        relatedRouteLabelEn: faq.relatedRouteLabelEn,
        relatedRouteLabelKm: faq.relatedRouteLabelKm,
        sortOrder: faq.sortOrder,
        isActive: faq.isActive,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
    };
}

function formatSupportPage(page: {
    id: string;
    publicId: string;
    pageKey: SupportPageKey;
    contentEn: unknown;
    contentKm: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: page.id,
        publicId: page.publicId,
        pageKey: page.pageKey,
        contentEn: page.contentEn,
        contentKm: page.contentKm,
        isActive: page.isActive,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
    };
}

async function writeAudit(
    adminUserId: string,
    eventType: AuditEventType,
    severity: AuditSeverity,
    actionEn: string,
    relatedRecordId: string
) {
    const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
    if (!adminProfile) return;
    await prisma.auditLog.create({
        data: {
            publicId: `AUD-${Date.now()}`,
            adminProfileId: adminProfile.id,
            actorName: adminProfile.fullName,
            eventType,
            severity,
            actionEn,
            relatedModule: "Help",
            relatedRecordId,
        },
    });
}

export class AdminHelpService {
    static async listFaqs(query: Record<string, unknown>, _lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit, 200);
        const audience = parseAudience(query.audience);
        const category = firstQueryString(query.category)?.trim();
        const search = firstQueryString(query.search)?.trim();
        const isActiveRaw = firstQueryString(query.isActive);

        const where: any = {};
        if (audience) where.audience = audience;
        if (category) where.category = category;
        if (isActiveRaw === "true") where.isActive = true;
        if (isActiveRaw === "false") where.isActive = false;
        if (search) {
            where.OR = [
                { questionEn: { contains: search, mode: "insensitive" } },
                { questionKm: { contains: search, mode: "insensitive" } },
                { answerEn: { contains: search, mode: "insensitive" } },
                { answerKm: { contains: search, mode: "insensitive" } },
                { publicId: { contains: search, mode: "insensitive" } },
            ];
        }

        const [faqs, total] = await Promise.all([
            prisma.faq.findMany({
                where,
                orderBy: [{ audience: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
                skip,
                take,
            }),
            prisma.faq.count({ where }),
        ]);

        return {
            items: faqs.map(formatFaq),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getFaqById(id: string, lang: Lang) {
        const faq = await prisma.faq.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!faq) throw new NotFoundException(t("ADMIN_FAQ_NOT_FOUND", lang));
        return formatFaq(faq);
    }

    static async createFaq(data: FaqBody, adminUserId: string, lang: Lang) {
        if (!data.audience || !data.questionEn || !data.questionKm || !data.answerEn || !data.answerKm) {
            throw new BadRequestException(t("ERROR_BAD_REQUEST", lang));
        }

        const maxSort = await prisma.faq.aggregate({
            where: { audience: data.audience },
            _max: { sortOrder: true },
        });

        const faq = await prisma.faq.create({
            data: {
                publicId: `faq-${data.audience.toLowerCase()}-${Date.now()}`,
                audience: data.audience,
                category: data.category?.trim() || "general",
                questionEn: data.questionEn.trim(),
                questionKm: data.questionKm.trim(),
                answerEn: data.answerEn.trim(),
                answerKm: data.answerKm.trim(),
                keywords: data.keywords ?? [],
                relatedRoute: emptyToNull(data.relatedRoute) ?? null,
                relatedRouteLabelEn: emptyToNull(data.relatedRouteLabelEn) ?? null,
                relatedRouteLabelKm: emptyToNull(data.relatedRouteLabelKm) ?? null,
                sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
                isActive: data.isActive ?? true,
            },
        });

        await writeAudit(adminUserId, "CREATED", "INFO", `Created FAQ: ${faq.questionEn}`, faq.publicId);
        return formatFaq(faq);
    }

    static async updateFaq(id: string, data: FaqBody, adminUserId: string, lang: Lang) {
        const faq = await prisma.faq.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!faq) throw new NotFoundException(t("ADMIN_FAQ_NOT_FOUND", lang));

        const updated = await prisma.faq.update({
            where: { id: faq.id },
            data: {
                ...(data.audience ? { audience: data.audience } : {}),
                ...(data.category !== undefined ? { category: data.category.trim() || "general" } : {}),
                ...(data.questionEn !== undefined ? { questionEn: data.questionEn.trim() } : {}),
                ...(data.questionKm !== undefined ? { questionKm: data.questionKm.trim() } : {}),
                ...(data.answerEn !== undefined ? { answerEn: data.answerEn.trim() } : {}),
                ...(data.answerKm !== undefined ? { answerKm: data.answerKm.trim() } : {}),
                ...(data.keywords !== undefined ? { keywords: data.keywords } : {}),
                ...(data.relatedRoute !== undefined ? { relatedRoute: emptyToNull(data.relatedRoute) } : {}),
                ...(data.relatedRouteLabelEn !== undefined
                    ? { relatedRouteLabelEn: emptyToNull(data.relatedRouteLabelEn) }
                    : {}),
                ...(data.relatedRouteLabelKm !== undefined
                    ? { relatedRouteLabelKm: emptyToNull(data.relatedRouteLabelKm) }
                    : {}),
                ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });

        await writeAudit(adminUserId, "UPDATED", "INFO", `Updated FAQ: ${updated.questionEn}`, updated.publicId);
        return formatFaq(updated);
    }

    static async disableFaq(id: string, adminUserId: string, lang: Lang) {
        const faq = await prisma.faq.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!faq) throw new NotFoundException(t("ADMIN_FAQ_NOT_FOUND", lang));

        const updated = await prisma.faq.update({
            where: { id: faq.id },
            data: { isActive: false },
        });
        await writeAudit(adminUserId, "DISABLED", "WARNING", `Disabled FAQ: ${faq.questionEn}`, faq.publicId);
        return formatFaq(updated);
    }

    static async restoreFaq(id: string, adminUserId: string, lang: Lang) {
        const faq = await prisma.faq.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!faq) throw new NotFoundException(t("ADMIN_FAQ_NOT_FOUND", lang));

        const updated = await prisma.faq.update({
            where: { id: faq.id },
            data: { isActive: true },
        });
        await writeAudit(adminUserId, "RESTORED", "INFO", `Restored FAQ: ${faq.questionEn}`, faq.publicId);
        return formatFaq(updated);
    }

    static async deleteFaq(id: string, adminUserId: string, lang: Lang) {
        const faq = await prisma.faq.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!faq) throw new NotFoundException(t("ADMIN_FAQ_NOT_FOUND", lang));

        await writeAudit(adminUserId, "DISABLED", "CRITICAL", `Deleted FAQ: ${faq.questionEn}`, faq.publicId);
        await prisma.faq.delete({ where: { id: faq.id } });
        return { deleted: true, id: faq.publicId };
    }

    static async listSupportPages() {
        const pages = await prisma.supportPage.findMany({
            orderBy: { pageKey: "asc" },
        });
        return { items: pages.map(formatSupportPage) };
    }

    static async getSupportPage(pageKey: string, lang: Lang) {
        const key = parsePageKey(pageKey);
        if (!key) throw new BadRequestException(t("ERROR_BAD_REQUEST", lang));

        const page = await prisma.supportPage.findUnique({ where: { pageKey: key } });
        if (!page) throw new NotFoundException(t("ADMIN_SUPPORT_PAGE_NOT_FOUND", lang));
        return formatSupportPage(page);
    }

    static async updateSupportPage(pageKey: string, data: SupportPageBody, adminUserId: string, lang: Lang) {
        const key = parsePageKey(pageKey);
        if (!key) throw new BadRequestException(t("ERROR_BAD_REQUEST", lang));

        const existing = await prisma.supportPage.findUnique({ where: { pageKey: key } });
        const nextContentEn = data.contentEn ?? (existing?.contentEn as Record<string, unknown> | undefined) ?? {};
        const nextContentKm = data.contentKm ?? (existing?.contentKm as Record<string, unknown> | undefined) ?? {};

        const page = existing
            ? await prisma.supportPage.update({
                  where: { pageKey: key },
                  data: {
                      ...(data.contentEn !== undefined ? { contentEn: data.contentEn as never } : {}),
                      ...(data.contentKm !== undefined ? { contentKm: data.contentKm as never } : {}),
                      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
                  },
              })
            : await prisma.supportPage.create({
                  data: {
                      publicId: `support-${key.toLowerCase()}`,
                      pageKey: key,
                      contentEn: nextContentEn as never,
                      contentKm: nextContentKm as never,
                      isActive: data.isActive ?? true,
                  },
              });

        await writeAudit(adminUserId, "UPDATED", "INFO", `Updated support page: ${key}`, page.publicId);
        return formatSupportPage(page);
    }

    static async listSupportRequests(query: Record<string, unknown>) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit, 100);
        const audience = parseAudience(query.audience);
        const status = parseStatus(query.status);
        const search = firstQueryString(query.search)?.trim();

        const where: any = {};
        if (audience) where.audience = audience;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { publicId: { contains: search, mode: "insensitive" } },
                { subject: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.supportRequest.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take,
                include: {
                    user: {
                        select: {
                            id: true,
                            phone: true,
                            email: true,
                            role: true,
                            customerProfile: { select: { fullName: true } },
                            providerProfile: {
                                select: {
                                    contactName: true,
                                    businessProfile: { select: { businessName: true } },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.supportRequest.count({ where }),
        ]);

        return {
            items: items.map((item) => ({
                id: item.id,
                publicId: item.publicId,
                audience: item.audience,
                category: item.category,
                subject: item.subject,
                description: item.description,
                relatedBookingId: item.relatedBookingId,
                relatedServiceId: item.relatedServiceId,
                status: item.status,
                createdAt: item.createdAt.toISOString(),
                updatedAt: item.updatedAt.toISOString(),
                user: {
                    id: item.user.id,
                    phone: item.user.phone,
                    email: item.user.email,
                    role: item.user.role,
                    name:
                        item.user.providerProfile?.businessProfile?.businessName ||
                        item.user.providerProfile?.contactName ||
                        item.user.customerProfile?.fullName ||
                        item.user.phone ||
                        "Unknown",
                },
            })),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async updateSupportRequest(id: string, status: SupportRequestStatus, adminUserId: string, lang: Lang) {
        const request = await prisma.supportRequest.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
        });
        if (!request) throw new NotFoundException(t("ADMIN_SUPPORT_REQUEST_NOT_FOUND", lang));

        const updated = await prisma.supportRequest.update({
            where: { id: request.id },
            data: { status },
        });
        await writeAudit(
            adminUserId,
            "UPDATED",
            "INFO",
            `Updated support ticket ${updated.publicId} to ${status}`,
            updated.publicId
        );
        return {
            id: updated.id,
            publicId: updated.publicId,
            status: updated.status,
            updatedAt: updated.updatedAt.toISOString(),
        };
    }
}
