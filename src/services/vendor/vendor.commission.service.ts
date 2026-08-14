import { prisma } from "../../database/prisma.client";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";
import { CommissionStatus, InvoiceStatus, NotificationType, SupportPageKey } from "../../generated/prisma/enums";
import QRCode from "qrcode";
import { BakongService } from "../bakong/bakong.service";
import { NotificationsHelper, InvoiceNotificationCopy } from "../notifications.helper";

function decimalNumber(value: { toNumber?: () => number } | number | string | null | undefined): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value) || 0;
    return value.toNumber?.() ?? 0;
}

export class VendorCommissionService {
    private static async requireProvider(userId: string, lang: Lang = "en") {
        const provider = await prisma.providerProfile.findUnique({
            where: { userId },
            select: { id: true, publicId: true, contactName: true },
        });
        if (!provider) {
            throw new NotFoundException(t("VENDOR_PROVIDER_PROFILE_NOT_FOUND", lang));
        }
        return provider;
    }

    /**
     * Get provider's sales, commissions, outstanding balance, and recent invoice summary.
     */
    static async getSummary(userId: string, lang: Lang = "en") {
        const provider = await this.requireProvider(userId, lang);

        const [allStats, paidStats, unpaidStats, recentInvoices] = await Promise.all([
            prisma.bookingCommission.aggregate({
                where: { providerProfileId: provider.id },
                _sum: {
                    bookingAmount: true,
                    commissionAmount: true,
                    providerEarning: true,
                },
                _count: { id: true },
            }),
            prisma.bookingCommission.aggregate({
                where: {
                    providerProfileId: provider.id,
                    status: CommissionStatus.PAID,
                },
                _sum: { commissionAmount: true },
            }),
            prisma.bookingCommission.aggregate({
                where: {
                    providerProfileId: provider.id,
                    status: CommissionStatus.UNPAID,
                },
                _sum: { commissionAmount: true },
            }),
            prisma.providerInvoice.findMany({
                where: { providerProfileId: provider.id },
                orderBy: { issuedAt: "desc" },
                take: 5,
                include: {
                    _count: { select: { commissions: true } },
                },
            }),
        ]);

        return {
            totalBookingsCompleted: allStats._count.id,
            totalSales: decimalNumber(allStats._sum.bookingAmount),
            totalCommission: decimalNumber(allStats._sum.commissionAmount),
            totalProviderEarnings: decimalNumber(allStats._sum.providerEarning),
            paidCommission: decimalNumber(paidStats._sum.commissionAmount),
            outstandingCommission: decimalNumber(unpaidStats._sum.commissionAmount),
            recentInvoices: recentInvoices.map((inv) => ({
                id: inv.id,
                publicId: inv.publicId,
                invoiceNumber: inv.invoiceNumber,
                totalBookingAmount: decimalNumber(inv.totalBookingAmount),
                totalCommission: decimalNumber(inv.totalCommission),
                itemCount: inv._count.commissions,
                status: inv.status,
                issuedAt: inv.issuedAt.toISOString(),
                dueAt: inv.dueAt?.toISOString() ?? null,
                paidAt: inv.paidAt?.toISOString() ?? null,
            })),
        };
    }

    /**
     * List invoices for current provider.
     */
    static async listInvoices(userId: string, query: Record<string, unknown>, lang: Lang = "en") {
        const provider = await this.requireProvider(userId, lang);
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const statusRaw = firstQueryString(query.status)?.trim().toUpperCase();

        const statusFilter =
            statusRaw === "PAID"
                ? InvoiceStatus.PAID
                : statusRaw === "UNPAID"
                  ? InvoiceStatus.UNPAID
                  : undefined;

        const where = {
            providerProfileId: provider.id,
            ...(statusFilter ? { status: statusFilter } : {}),
        };

        const [invoices, total] = await Promise.all([
            prisma.providerInvoice.findMany({
                where,
                skip,
                take,
                orderBy: { issuedAt: "desc" },
                include: {
                    _count: { select: { commissions: true } },
                },
            }),
            prisma.providerInvoice.count({ where }),
        ]);

        return {
            items: invoices.map((inv) => ({
                id: inv.id,
                publicId: inv.publicId,
                invoiceNumber: inv.invoiceNumber,
                totalBookingAmount: decimalNumber(inv.totalBookingAmount),
                totalCommission: decimalNumber(inv.totalCommission),
                itemCount: inv._count.commissions,
                status: inv.status,
                issuedAt: inv.issuedAt.toISOString(),
                dueAt: inv.dueAt?.toISOString() ?? null,
                paidAt: inv.paidAt?.toISOString() ?? null,
                paymentReference: inv.paymentReference,
                notes: inv.notes,
            })),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    /**
     * Get single invoice detail with line items for current provider.
     */
    static async getInvoiceById(userId: string, id: string, lang: Lang = "en") {
        const provider = await this.requireProvider(userId, lang);

        const invoice = await prisma.providerInvoice.findFirst({
            where: {
                providerProfileId: provider.id,
                OR: [{ id }, { publicId: id }, { invoiceNumber: id }],
            },
            include: {
                providerProfile: {
                    select: {
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
            throw new NotFoundException(t("VENDOR_COMMISSION_INVOICE_NOT_FOUND", lang));
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

        // Fetch Platform Admin profile for company details
        const adminProfile = await prisma.adminProfile.findFirst({
            include: { user: true },
            orderBy: { updatedAt: "desc" },
        });

        const companyInfo = {
            name: adminProfile?.fullName || "FixItHome",
            companyName: adminProfile?.jobTitle || "FixItHome Technologies Co., Ltd.",
            email: adminProfile?.user?.email || "info.gtwotech@gmail.com",
            phone: adminProfile?.user?.phone || "+855 14 277 299",
            address: "Phnom Penh, Cambodia",
        };

        // Fetch Support Contact for Telegram QR
        const supportPage = await prisma.supportPage.findFirst({
            where: {
                pageKey: SupportPageKey.PROVIDER_CONTACT,
                isActive: true,
            },
        });

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
            console.error("[Vendor Invoice] Failed to generate Telegram QR:", e);
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
        };
    }

    static async submitPaymentProof(
        userId: string,
        invoiceId: string,
        payload: { paymentProofUrl: string; paymentReference?: string; notes?: string },
        lang: Lang = "en"
    ) {
        const provider = await this.requireProvider(userId, lang);

        if (!payload.paymentProofUrl?.trim()) {
            throw new BadRequestException(
                lang === "kh" ? "សូមបញ្ចូលរូបភាពភស្តុតាងទូទាត់" : "Payment proof image is required"
            );
        }

        const invoice = await prisma.providerInvoice.findFirst({
            where: {
                providerProfileId: provider.id,
                OR: [{ id: invoiceId }, { publicId: invoiceId }, { invoiceNumber: invoiceId }],
            },
            include: {
                providerProfile: {
                    include: {
                        businessProfile: { select: { businessName: true } },
                    },
                },
            },
        });

        if (!invoice) {
            throw new NotFoundException(t("VENDOR_COMMISSION_INVOICE_NOT_FOUND", lang));
        }

        if (invoice.status === InvoiceStatus.PAID) {
            throw new BadRequestException(
                lang === "kh" ? "វិក្កយបត្រនេះត្រូវបានទូទាត់រួចរាល់ហើយ" : "This invoice has already been paid"
            );
        }

        await prisma.providerInvoice.update({
            where: { id: invoice.id },
            data: {
                paymentProofUrl: payload.paymentProofUrl.trim(),
                paymentProofSubmittedAt: new Date(),
                paymentReference: payload.paymentReference?.trim() || invoice.paymentReference,
                notes: payload.notes?.trim() || invoice.notes,
            },
        });

        const providerName =
            invoice.providerProfile.businessProfile?.businessName ||
            invoice.providerProfile.contactName ||
            "Provider";
        const totalCommissionVal = decimalNumber(invoice.totalCommission);

        // Dispatch in-app & push notification to admins
        try {
            const copy = InvoiceNotificationCopy.paymentSubmittedForAdmin(
                providerName,
                invoice.invoiceNumber,
                totalCommissionVal
            );
            await NotificationsHelper.notifyAdmins({
                titleEn: copy.titleEn,
                titleKm: copy.titleKm,
                messageEn: copy.messageEn,
                messageKm: copy.messageKm,
                type: NotificationType.PROVIDER,
                priority: "HIGH",
                relatedModule: "COMMISSION_INVOICE",
                relatedRecordId: invoice.id,
                relatedRoute: `/admin/commission/invoices/${invoice.publicId}`,
            });
        } catch (notifErr) {
            console.error("[Vendor Commission] Failed to notify admin:", notifErr);
        }

        return this.getInvoiceById(userId, invoice.id, lang);
    }
}
