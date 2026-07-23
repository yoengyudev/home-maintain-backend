import { prisma } from "../../database/prisma.client";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";

type AuditLogQuery = {
    page?: unknown;
    limit?: unknown;
    module?: unknown;
    eventType?: unknown;
    severity?: unknown;
};

function formatAuditLog(log: any) {
    return {
        id: log.id,
        publicId: log.publicId,
        actorName: log.actorName,
        eventType: log.eventType,
        severity: log.severity,
        actionEn: log.actionEn,
        actionKm: log.actionKm,
        reasonEn: log.reasonEn,
        reasonKm: log.reasonKm,
        relatedModule: log.relatedModule,
        relatedRecordId: log.relatedRecordId,
        relatedRoute: log.relatedRoute,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
    };
}

export class AdminAuditService {
    static async list(query: AuditLogQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);

        const moduleRaw = firstQueryString(query.module)?.trim();
        const eventTypeRaw = firstQueryString(query.eventType)?.trim().toUpperCase();
        const severityRaw = firstQueryString(query.severity)?.trim().toUpperCase();

        const where: any = {
            ...(moduleRaw ? { relatedModule: moduleRaw } : {}),
            ...(eventTypeRaw ? { eventType: eventTypeRaw as any } : {}),
            ...(severityRaw ? { severity: severityRaw as any } : {}),
        };

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.auditLog.count({ where }),
        ]);

        return {
            items: logs.map(formatAuditLog),
            meta: buildPaginationMeta(page, limit, total),
        };
    }
}
