import { prisma } from "../../database/prisma.client";
import { NotFoundException, BadRequestException } from "../../utils/app-error.util";
import { AccountStatus, UserRole } from "../../generated/prisma/enums";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

const customerInclude = {
    user: { select: { email: true, phone: true, accountStatus: true } },
} as const;

function formatCustomer(c: any) {
    return {
        id: c.id,
        publicId: c.publicId,
        fullName: c.fullName,
        email: c.user?.email ?? "",
        phone: c.user?.phone ?? null,
        avatarUrl: c.avatarUrl,
        accountStatus: c.user?.accountStatus ?? "ACTIVE",
        suspendedAt: c.suspendedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
    };
}

type CustomersQuery = {
    page?: unknown;
    limit?: unknown;
    status?: unknown;
    search?: unknown;
};

export class AdminCustomersService {
    static async list(query: CustomersQuery, lang: Lang) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();
        const search = firstQueryString(query.search)?.trim();

        const validStatuses = Object.values(AccountStatus) as string[];
        const statusFilter =
            statusRaw && validStatuses.includes(statusRaw)
                ? (statusRaw as AccountStatus)
                : undefined;

        const where: any = {
            user: {
                role: UserRole.CUSTOMER,
                ...(statusFilter ? { accountStatus: statusFilter } : {}),
            },
            ...(search
                ? {
                      OR: [
                          { fullName: { contains: search, mode: "insensitive" } },
                          { user: { email: { contains: search, mode: "insensitive" } } },
                      ],
                  }
                : {}),
        };

        const [customers, total] = await Promise.all([
            prisma.customerProfile.findMany({
                where,
                include: customerInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.customerProfile.count({ where }),
        ]);

        return {
            items: customers.map(formatCustomer),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    static async getById(id: string, lang: Lang) {
        const customer = await prisma.customerProfile.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: customerInclude,
        });
        if (!customer) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        return formatCustomer(customer);
    }

    static async suspend(id: string, reason: string, adminUserId: string, lang: Lang) {
        const customer = await prisma.customerProfile.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: { user: true },
        });
        if (!customer) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (customer.user.accountStatus === AccountStatus.SUSPENDED) {
            throw new BadRequestException("Customer is already suspended");
        }

        await prisma.user.update({
            where: { id: customer.userId },
            data: { accountStatus: AccountStatus.SUSPENDED },
        });
        await prisma.customerProfile.update({
            where: { id: customer.id },
            data: { suspendedAt: new Date() },
        });

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });
        if (adminProfile) {
            await prisma.auditLog.create({
                data: {
                    publicId: `AUD-${Date.now()}`,
                    adminProfileId: adminProfile.id,
                    actorName: adminProfile.fullName,
                    eventType: "SUSPENDED",
                    severity: "WARNING",
                    actionEn: `Suspended customer: ${customer.fullName}`,
                    relatedModule: "Customers",
                    relatedRecordId: customer.publicId,
                    reasonEn: reason,
                },
            });
        }

        const updated = await prisma.customerProfile.findUnique({
            where: { id: customer.id },
            include: customerInclude,
        });
        return formatCustomer(updated!);
    }

    static async restore(id: string, adminUserId: string, lang: Lang) {
        const customer = await prisma.customerProfile.findFirst({
            where: { OR: [{ id }, { publicId: id }] },
            include: { user: true },
        });
        if (!customer) throw new NotFoundException(t("ERROR_NOT_FOUND", lang));
        if (customer.user.accountStatus !== AccountStatus.SUSPENDED) {
            throw new BadRequestException("Customer is not suspended");
        }

        await prisma.user.update({
            where: { id: customer.userId },
            data: { accountStatus: AccountStatus.ACTIVE },
        });
        await prisma.customerProfile.update({
            where: { id: customer.id },
            data: { suspendedAt: null },
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
                    actionEn: `Restored customer: ${customer.fullName}`,
                    relatedModule: "Customers",
                    relatedRecordId: customer.publicId,
                },
            });
        }

        const updated = await prisma.customerProfile.findUnique({
            where: { id: customer.id },
            include: customerInclude,
        });
        return formatCustomer(updated!);
    }
}
