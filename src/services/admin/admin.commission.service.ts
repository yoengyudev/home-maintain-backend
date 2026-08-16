import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { CommissionStatus, CommissionType, InvoiceStatus, NotificationType, SupportPageKey } from "../../generated/prisma/enums";
import QRCode from "qrcode";
import { BakongService } from "../bakong/bakong.service";
import { NotificationsHelper, InvoiceNotificationCopy } from "../notifications.helper";

function decimalNumber(value: { toNumber?: () => number } | number | string | null | undefined): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value) || 0;
    return value.toNumber?.() ?? 0;
}

export class AdminCommissionService {
    /**
     * Get active commission setting, or default if none yet.
     */
    static async getSetting(lang: Lang = "en") {
        let setting = await prisma.commissionSetting.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
        });

        if (!setting) {
            setting = await prisma.commissionSetting.create({
                data: {
                    publicId: `CSET-${Date.now()}`,
                    type: CommissionType.PERCENTAGE,
                    value: 5.0,
                    description: "Default platform commission (5%)",
                    isActive: true,
                },
            });
        }

        return {
            id: setting.id,
            publicId: setting.publicId,
            type: setting.type,
            value: decimalNumber(setting.value),
            description: setting.description,
            isActive: setting.isActive,
            updatedAt: setting.updatedAt.toISOString(),
        };
    }

    /**
     * Update active commission setting or create new version.
     */
    static async updateSetting(
        data: { type: "PERCENTAGE" | "FIXED"; value: number; description?: string | null },
        lang: Lang = "en"
    ) {
        const active = await prisma.commissionSetting.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
        });

        if (active) {
            const updated = await prisma.commissionSetting.update({
                where: { id: active.id },
                data: {
                    type: data.type === "FIXED" ? CommissionType.FIXED : CommissionType.PERCENTAGE,
                    value: data.value,
                    description: data.description ?? null,
                },
            });
            return {
                id: updated.id,
                publicId: updated.publicId,
                type: updated.type,
                value: decimalNumber(updated.value),
                description: updated.description,
                isActive: updated.isActive,
                updatedAt: updated.updatedAt.toISOString(),
            };
        }

        const created = await prisma.commissionSetting.create({
            data: {
                publicId: `CSET-${Date.now()}`,
                type: data.type === "FIXED" ? CommissionType.FIXED : CommissionType.PERCENTAGE,
                value: data.value,
                description: data.description ?? null,
                isActive: true,
            },
        });

        return {
            id: created.id,
            publicId: created.publicId,
            type: created.type,
            value: decimalNumber(created.value),
            description: created.description,
            isActive: created.isActive,
            updatedAt: created.updatedAt.toISOString(),
        };
    }

    /**
     * List commission records with filtering.
     */
    static async listCommissions(query: Record<string, unknown>, lang: Lang = "en") {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();
        const providerId = firstQueryString(query.providerId)?.trim();
        const invoiceId = firstQueryString(query.invoiceId)?.trim();
        const search = firstQueryString(query.search)?.trim();
        const fromDate = firstQueryString(query.fromDate)?.trim();
        const toDate = firstQueryString(query.toDate)?.trim();

        const statusFilter =
            statusRaw === "PAID"
                ? CommissionStatus.PAID
                : statusRaw === "UNPAID"
                  ? CommissionStatus.UNPAID
                  : undefined;

        const where: any = {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(providerId
                ? {
                      OR: [
                          { providerProfileId: providerId },
                          { providerProfile: { publicId: providerId } },
                      ],
                  }
                : {}),
            ...(invoiceId
                ? {
                      OR: [
                          { invoiceId },
                          { invoice: { publicId: invoiceId } },
                          { invoice: { invoiceNumber: invoiceId } },
                      ],
                  }
                : {}),
            ...(search
                ? {
                      OR: [
                          { publicId: { contains: search, mode: "insensitive" } },
                          { booking: { publicId: { contains: search, mode: "insensitive" } } },
                          {
                              providerProfile: {
                                  businessProfile: {
                                      businessName: { contains: search, mode: "insensitive" },
                                  },
                              },
                          },
                          {
                              providerProfile: {
                                  contactName: { contains: search, mode: "insensitive" },
                              },
                          },
                          {
                              booking: {
                                  customerProfile: {
                                      fullName: { contains: search, mode: "insensitive" },
                                  },
                              },
                          },
                      ],
                  }
                : {}),
            ...(fromDate || toDate
                ? {
                      createdAt: {
                          ...(fromDate ? { gte: new Date(fromDate) } : {}),
                          ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {}),
                      },
                  }
                : {}),
        };

        const [records, total, stats] = await Promise.all([
            prisma.bookingCommission.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
                include: {
                    booking: {
                        select: {
                            id: true,
                            publicId: true,
                            serviceListing: { select: { name: true, nameKm: true } },
                            customerProfile: { select: { id: true, publicId: true, fullName: true } },
                        },
                    },
                    providerProfile: {
                        select: {
                            id: true,
                            publicId: true,
                            contactName: true,
                            businessProfile: { select: { businessName: true } },
                            user: { select: { email: true, phone: true } },
                        },
                    },
                    invoice: {
                        select: {
                            id: true,
                            publicId: true,
                            invoiceNumber: true,
                            status: true,
                        },
                    },
                },
            }),
            prisma.bookingCommission.count({ where }),
            prisma.bookingCommission.aggregate({
                where,
                _sum: {
                    bookingAmount: true,
                    commissionAmount: true,
                    providerEarning: true,
                },
            }),
        ]);

        const formatted = records.map((r) => ({
            id: r.id,
            publicId: r.publicId,
            bookingId: r.booking.publicId || r.booking.id,
            serviceName: r.booking.serviceListing?.name || "Service",
            customerName: r.booking.customerProfile?.fullName || "Customer",
            providerId: r.providerProfile.publicId || r.providerProfile.id,
            providerName:
                r.providerProfile.businessProfile?.businessName ||
                r.providerProfile.contactName ||
                "Provider",
            providerEmail: r.providerProfile.user?.email || "",
            providerPhone: r.providerProfile.user?.phone || "",
            bookingAmount: decimalNumber(r.bookingAmount),
            commissionType: r.commissionType,
            commissionRate: decimalNumber(r.commissionRate),
            commissionAmount: decimalNumber(r.commissionAmount),
            providerEarning: decimalNumber(r.providerEarning),
            status: r.status,
            paidAt: r.paidAt?.toISOString() ?? null,
            invoiceId: r.invoice?.publicId ?? null,
            invoiceNumber: r.invoice?.invoiceNumber ?? null,
            invoiceStatus: r.invoice?.status ?? null,
            createdAt: r.createdAt.toISOString(),
        }));

        return {
            items: formatted,
            meta: buildPaginationMeta(page, limit, total),
            summary: {
                totalBookingAmount: decimalNumber(stats._sum.bookingAmount),
                totalCommissionAmount: decimalNumber(stats._sum.commissionAmount),
                totalProviderEarning: decimalNumber(stats._sum.providerEarning),
            },
        };
    }

    /**
     * Generate an invoice for selected unpaid commission records of a provider.
     */
    static async generateInvoice(
        data: {
            providerProfileId?: string | null;
            commissionIds: string[];
            dueAt?: string | null;
            notes?: string | null;
        },
        lang: Lang = "en"
    ) {
        if (!data.commissionIds || data.commissionIds.length === 0) {
            throw new BadRequestException(t("ADMIN_COMMISSION_INVALID_RECORDS", lang));
        }

        // Fetch all selected commission records
        const commissions = await prisma.bookingCommission.findMany({
            where: {
                OR: [
                    { id: { in: data.commissionIds } },
                    { publicId: { in: data.commissionIds } },
                ],
                status: CommissionStatus.UNPAID,
                invoiceId: null,
            },
            include: {
                providerProfile: {
                    include: { businessProfile: true },
                },
            },
        });

        if (commissions.length === 0 || commissions.length !== data.commissionIds.length) {
            throw new BadRequestException(t("ADMIN_COMMISSION_INVALID_RECORDS", lang));
        }

        // Strict Check: Ensure all selected commission records belong to the EXACT same provider
        const uniqueProviderIds = Array.from(new Set(commissions.map((c) => c.providerProfileId)));
        if (uniqueProviderIds.length > 1) {
            throw new BadRequestException(t("ADMIN_COMMISSION_MIXED_PROVIDERS", lang));
        }

        // Resolve target provider profile
        const targetProviderId = uniqueProviderIds[0];
        const provider = commissions[0].providerProfile;

        if (data.providerProfileId) {
            const matchesProvider =
                provider.id === data.providerProfileId ||
                provider.publicId === data.providerProfileId;
            if (!matchesProvider) {
                throw new BadRequestException(t("ADMIN_COMMISSION_MIXED_PROVIDERS", lang));
            }
        }

        const totalBookingAmount = commissions.reduce(
            (acc, curr) => acc + decimalNumber(curr.bookingAmount),
            0
        );
        const totalCommission = commissions.reduce(
            (acc, curr) => acc + decimalNumber(curr.commissionAmount),
            0
        );

        // Generate invoice number e.g. INV-2026-0001
        const year = new Date().getFullYear();
        const yearPrefix = `INV-${year}-`;
        const lastInvoice = await prisma.providerInvoice.findFirst({
            where: { invoiceNumber: { startsWith: yearPrefix } },
            orderBy: { invoiceNumber: "desc" },
            select: { invoiceNumber: true },
        });

        const lastSeq = lastInvoice
            ? Number(lastInvoice.invoiceNumber.replace(yearPrefix, "")) || 0
            : 0;
        const invoiceNumber = `${yearPrefix}${String(lastSeq + 1).padStart(4, "0")}`;
        const invoicePublicId = `INV-${crypto.randomUUID()}`;

        const invoice = await prisma.$transaction(async (tx) => {
            const created = await tx.providerInvoice.create({
                data: {
                    publicId: invoicePublicId,
                    invoiceNumber,
                    providerProfileId: provider.id,
                    totalBookingAmount,
                    totalCommission,
                    status: InvoiceStatus.UNPAID,
                    issuedAt: new Date(),
                    dueAt: data.dueAt ? new Date(data.dueAt) : null,
                    notes: data.notes ?? null,
                },
            });

            await tx.bookingCommission.updateMany({
                where: { id: { in: commissions.map((c) => c.id) } },
                data: { invoiceId: created.id },
            });

            return created;
        });

        // Dispatch Notification & FCM Push to Provider
        if (provider.userId) {
            NotificationsHelper.notifyUser(provider.userId, {
                ...InvoiceNotificationCopy.generatedForVendor(invoiceNumber, totalCommission),
                type: NotificationType.SYSTEM,
                priority: "HIGH",
                relatedModule: "COMMISSION_INVOICE",
                relatedRecordId: invoice.publicId,
                relatedRoute: `/provider/commission/invoices/${invoice.publicId}`,
            }).catch((err) => {
                console.error("[Notifications] Failed to notify provider of generated invoice:", err);
            });
        }

        return this.getInvoiceById(invoice.id, lang);
    }

    /**
     * List all generated invoices.
     */
    static async listInvoices(query: Record<string, unknown>, lang: Lang = "en") {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();
        const providerId = firstQueryString(query.providerId)?.trim();
        const search = firstQueryString(query.search)?.trim();
        const fromDate = firstQueryString(query.fromDate)?.trim();
        const toDate = firstQueryString(query.toDate)?.trim();

        const statusFilter =
            statusRaw === "PAID"
                ? InvoiceStatus.PAID
                : statusRaw === "UNPAID"
                  ? InvoiceStatus.UNPAID
                  : undefined;

        const where: any = {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(providerId
                ? {
                      OR: [
                          { providerProfileId: providerId },
                          { providerProfile: { publicId: providerId } },
                      ],
                  }
                : {}),
            ...(search
                ? {
                      OR: [
                          { invoiceNumber: { contains: search, mode: "insensitive" } },
                          { publicId: { contains: search, mode: "insensitive" } },
                          {
                              providerProfile: {
                                  businessProfile: {
                                      businessName: { contains: search, mode: "insensitive" },
                                  },
                              },
                          },
                          {
                              providerProfile: {
                                  contactName: { contains: search, mode: "insensitive" },
                              },
                          },
                      ],
                  }
                : {}),
            ...(fromDate || toDate
                ? {
                      issuedAt: {
                          ...(fromDate ? { gte: new Date(fromDate) } : {}),
                          ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {}),
                      },
                  }
                : {}),
        };

        const [invoices, total, stats] = await Promise.all([
            prisma.providerInvoice.findMany({
                where,
                skip,
                take,
                orderBy: { issuedAt: "desc" },
                include: {
                    providerProfile: {
                        select: {
                            id: true,
                            publicId: true,
                            contactName: true,
                            businessProfile: { select: { businessName: true } },
                            user: { select: { email: true, phone: true } },
                        },
                    },
                    _count: {
                        select: { commissions: true },
                    },
                },
            }),
            prisma.providerInvoice.count({ where }),
            prisma.providerInvoice.aggregate({
                where,
                _sum: {
                    totalBookingAmount: true,
                    totalCommission: true,
                },
            }),
        ]);

        const formatted = invoices.map((inv) => ({
            id: inv.id,
            publicId: inv.publicId,
            invoiceNumber: inv.invoiceNumber,
            providerId: inv.providerProfile.publicId || inv.providerProfile.id,
            providerName:
                inv.providerProfile.businessProfile?.businessName ||
                inv.providerProfile.contactName ||
                "Provider",
            providerEmail: inv.providerProfile.user?.email || "",
            providerPhone: inv.providerProfile.user?.phone || "",
            totalBookingAmount: decimalNumber(inv.totalBookingAmount),
            totalCommission: decimalNumber(inv.totalCommission),
            itemCount: inv._count.commissions,
            status: inv.status,
            issuedAt: inv.issuedAt.toISOString(),
            dueAt: inv.dueAt?.toISOString() ?? null,
            paidAt: inv.paidAt?.toISOString() ?? null,
            paymentReference: inv.paymentReference,
            notes: inv.notes,
            createdAt: inv.createdAt.toISOString(),
        }));

        return {
            items: formatted,
            meta: buildPaginationMeta(page, limit, total),
            summary: {
                totalBookingAmount: decimalNumber(stats._sum.totalBookingAmount),
                totalCommission: decimalNumber(stats._sum.totalCommission),
            },
        };
    }

    /**
     * Get single invoice detail with line items.
     */
    static async getInvoiceById(id: string, lang: Lang = "en") {
        const invoice = await prisma.providerInvoice.findFirst({
            where: {
                OR: [{ id }, { publicId: id }, { invoiceNumber: id }],
            },
            include: {
                providerProfile: {
                    select: {
                        id: true,
                        publicId: true,
                        contactName: true,
                        businessProfile: {
                            select: {
                                businessName: true,
                                addressLine: true,
                                district: true,
                                cityProvince: true,
                            },
                        },
                        user: { select: { email: true, phone: true } },
                    },
                },
                commissions: {
                    orderBy: { createdAt: "asc" },
                    include: {
                        booking: {
                            select: {
                                id: true,
                                publicId: true,
                                scheduledAt: true,
                                timeSlot: true,
                                serviceListing: { select: { name: true, nameKm: true } },
                                customerProfile: { select: { fullName: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!invoice) {
            throw new NotFoundException(t("ADMIN_COMMISSION_INVOICE_NOT_FOUND", lang));
        }

        const totalCommissionVal = decimalNumber(invoice.totalCommission);

        // Generate Bakong KHQR for payment
        const bakongQr = await BakongService.generateInvoicePaymentQr({
            billNumber: invoice.invoiceNumber,
            amount: totalCommissionVal,
            currency: "USD",
            dueAt: invoice.dueAt,
            purpose: `FixItHome Invoice ${invoice.invoiceNumber}`,
        });

        // Fetch Support Contact for company details & Telegram QR
        const supportPage =
            (await prisma.supportPage.findFirst({
                where: {
                    pageKey: SupportPageKey.PROVIDER_CONTACT,
                    isActive: true,
                },
            })) ||
            (await prisma.supportPage.findFirst({
                where: {
                    pageKey: SupportPageKey.CUSTOMER_CONTACT,
                    isActive: true,
                },
            }));

        const contactEn = (supportPage?.contentEn || {}) as Record<string, any>;
        const contactKm = (supportPage?.contentKm || {}) as Record<string, any>;

        const companyAddress =
            lang === "kh" || (lang as string) === "km"
                ? String(
                      contactKm.addressKm ||
                          contactKm.address ||
                          contactEn.addressEn ||
                          contactEn.address ||
                          "រាជធានីភ្នំពេញ កម្ពុជា"
                  )
                : String(
                      contactEn.addressEn ||
                          contactEn.address ||
                          contactKm.addressKm ||
                          contactKm.address ||
                          "Phnom Penh, Cambodia"
                  );

        const companyInfo = {
            name: "FixItHome",
            companyName: String(
                contactEn.companyName ||
                    contactKm.companyName ||
                    "FixItHome Technologies Co., Ltd."
            ),
            email: String(
                contactEn.email ||
                    contactKm.email ||
                    "info.gtwotech@gmail.com"
            ),
            phone: String(
                contactEn.phoneDisplay ||
                    contactEn.phone ||
                    contactKm.phoneDisplay ||
                    contactKm.phone ||
                    "014-277-299"
            ),
            address: companyAddress,
        };

        const contactRaw = (supportPage?.contentEn || supportPage?.contentKm) as any;
        let telegramHandle = String(contactRaw?.telegramHandle || "").trim().replace(/^@/, '');
        let rawTelegramUrl = String(contactRaw?.telegramUrl || "").trim().replace(/\s+/g, "");

        let telegramUrl = "https://t.me/FixItHome_Support";
        if (rawTelegramUrl) {
            if (rawTelegramUrl.startsWith("http://") || rawTelegramUrl.startsWith("https://")) {
                telegramUrl = rawTelegramUrl;
            } else if (rawTelegramUrl.startsWith("t.me/")) {
                telegramUrl = `https://${rawTelegramUrl}`;
            } else {
                telegramUrl = `https://t.me/${rawTelegramUrl.replace(/^@/, "")}`;
            }
        } else if (telegramHandle) {
            telegramUrl = `https://t.me/${telegramHandle}`;
        }

        if (!telegramHandle && telegramUrl.includes("t.me/")) {
            telegramHandle = telegramUrl.split("t.me/")[1]?.split(/[\/?#]/)[0] || "Support";
        } else if (!telegramHandle) {
            telegramHandle = "FixItHome_Support";
        }

        let telegramQrImage: string | null = null;
        try {
            telegramQrImage = await QRCode.toDataURL(telegramUrl, {
                errorCorrectionLevel: "M",
                margin: 2,
                width: 280,
            });
        } catch (e) {
            console.error("[Invoice] Failed to generate Telegram QR:", e);
        }

        const telegramInfo = {
            handle: telegramHandle,
            url: telegramUrl,
            qrImage: telegramQrImage,
        };

        return {
            id: invoice.id,
            publicId: invoice.publicId,
            invoiceNumber: invoice.invoiceNumber,
            company: companyInfo,
            telegram: telegramInfo,
            provider: {
                id: invoice.providerProfile.id,
                publicId: invoice.providerProfile.publicId,
                name:
                    invoice.providerProfile.businessProfile?.businessName ||
                    invoice.providerProfile.contactName ||
                    "Provider",
                contactName: invoice.providerProfile.contactName,
                email: invoice.providerProfile.user?.email || "",
                phone: invoice.providerProfile.user?.phone || "",
                address: [
                    invoice.providerProfile.businessProfile?.addressLine,
                    invoice.providerProfile.businessProfile?.district,
                    invoice.providerProfile.businessProfile?.cityProvince,
                ]
                    .filter(Boolean)
                    .join(", "),
            },
            totalBookingAmount: decimalNumber(invoice.totalBookingAmount),
            totalCommission: totalCommissionVal,
            status: invoice.status,
            issuedAt: invoice.issuedAt.toISOString(),
            dueAt: invoice.dueAt?.toISOString() ?? null,
            paidAt: invoice.paidAt?.toISOString() ?? null,
            paymentReference: invoice.paymentReference,
            paymentProofUrl: invoice.paymentProofUrl,
            paymentProofSubmittedAt: invoice.paymentProofSubmittedAt?.toISOString() ?? null,
            notes: invoice.notes,
            bakong: bakongQr,
            items: invoice.commissions.map((c) => ({
                id: c.id,
                publicId: c.publicId,
                bookingId: c.booking.publicId || c.booking.id,
                serviceName: c.booking.serviceListing?.name || "Service",
                customerName: c.booking.customerProfile?.fullName || "Customer",
                bookingDate: c.booking.scheduledAt.toISOString().slice(0, 10),
                bookingAmount: decimalNumber(c.bookingAmount),
                commissionType: c.commissionType,
                commissionRate: decimalNumber(c.commissionRate),
                commissionAmount: decimalNumber(c.commissionAmount),
                providerEarning: decimalNumber(c.providerEarning),
                status: c.status,
            })),
            createdAt: invoice.createdAt.toISOString(),
            updatedAt: invoice.updatedAt.toISOString(),
        };
    }

    /**
     * Mark an invoice as Paid.
     */
    static async markInvoicePaid(
        id: string,
        data: { paymentReference?: string | null; notes?: string | null; paidAt?: string | null },
        lang: Lang = "en"
    ) {
        const invoice = await prisma.providerInvoice.findFirst({
            where: {
                OR: [{ id }, { publicId: id }, { invoiceNumber: id }],
            },
        });

        if (!invoice) {
            throw new NotFoundException(t("ADMIN_COMMISSION_INVOICE_NOT_FOUND", lang));
        }

        const paidDate = data.paidAt ? new Date(data.paidAt) : new Date();

        await prisma.$transaction(async (tx) => {
            await tx.providerInvoice.update({
                where: { id: invoice.id },
                data: {
                    status: InvoiceStatus.PAID,
                    paidAt: paidDate,
                    paymentReference: data.paymentReference ?? invoice.paymentReference,
                    notes: data.notes ?? invoice.notes,
                },
            });

            await tx.bookingCommission.updateMany({
                where: { invoiceId: invoice.id },
                data: {
                    status: CommissionStatus.PAID,
                    paidAt: paidDate,
                },
            });
        });

        // Dispatch Notification & FCM Push to Provider
        const fullInvoice = await prisma.providerInvoice.findUnique({
            where: { id: invoice.id },
            include: { providerProfile: true },
        });
        if (fullInvoice?.providerProfile?.userId) {
            NotificationsHelper.notifyUser(fullInvoice.providerProfile.userId, {
                ...InvoiceNotificationCopy.paidForVendor(
                    fullInvoice.invoiceNumber,
                    decimalNumber(fullInvoice.totalCommission)
                ),
                type: NotificationType.SYSTEM,
                priority: "NORMAL",
                relatedModule: "COMMISSION_INVOICE",
                relatedRecordId: fullInvoice.publicId,
                relatedRoute: `/provider/commission/invoices/${fullInvoice.publicId}`,
            }).catch((err) => {
                console.error("[Notifications] Failed to notify provider of paid invoice:", err);
            });
        }

        return this.getInvoiceById(invoice.id, lang);
    }
}
