import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import {
    FaqAudience,
    NotificationType,
    SupportPageKey,
    UserRole,
} from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { NotFoundException } from "../../utils/app-error.util";
import { t } from "../../i18n/translate";
import { NotificationsHelper } from "../notifications.helper";
import type { z } from "zod";
import type { vendorSupportRequestSchema } from "../../validators/vendor/vendor.help.validator";

type SupportRequestDto = z.infer<typeof vendorSupportRequestSchema>;

type ContactContent = {
    telegramHandle?: string;
    telegramUrl?: string;
    phone?: string;
    phoneDisplay?: string;
    email?: string;
    hoursEn?: string;
    hoursKm?: string;
    hours?: string;
};

export class VendorHelpService {
    static async getHelp(lang: Lang) {
        const [faqs, contactPage] = await Promise.all([
            prisma.faq.findMany({
                where: {
                    audience: FaqAudience.PROVIDER,
                    isActive: true,
                    deletedAt: null,
                },
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            }),
            prisma.supportPage.findFirst({
                where: {
                    pageKey: SupportPageKey.PROVIDER_CONTACT,
                    isActive: true,
                },
            }),
        ]);

        const contactRaw = contactPage
            ? ((lang === "kh" ? contactPage.contentKm : contactPage.contentEn) as ContactContent)
            : null;

        const contact = contactRaw
            ? {
                  telegramHandle: contactRaw.telegramHandle || "",
                  telegramUrl: contactRaw.telegramUrl || "",
                  phone: contactRaw.phone || "",
                  phoneDisplay: contactRaw.phoneDisplay || "",
                  email: contactRaw.email || "",
                  hours:
                      ("hours" in contactRaw && contactRaw.hours) ||
                      (lang === "kh" ? contactRaw.hoursKm || "" : contactRaw.hoursEn || "") ||
                      "",
              }
            : null;

        return {
            contact,
            faqs: faqs.map((faq) => ({
                publicId: faq.publicId,
                category: faq.category,
                question: {
                    en: faq.questionEn,
                    km: faq.questionKm,
                },
                answer: {
                    en: faq.answerEn,
                    km: faq.answerKm,
                },
                keywords: faq.keywords,
                relatedRoute: faq.relatedRoute,
                relatedRouteLabel: faq.relatedRoute
                    ? {
                          en: faq.relatedRouteLabelEn || "",
                          km: faq.relatedRouteLabelKm || "",
                      }
                    : undefined,
            })),
        };
    }

    static async submitRequest(userId: string, data: SupportRequestDto, lang: Lang) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                providerProfile: {
                    include: { businessProfile: true },
                },
            },
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException(t("VENDOR_USER_NOT_FOUND", lang));
        }

        const relatedBookingId = data.relatedBookingId?.trim() || null;
        const relatedServiceId = data.relatedServiceId?.trim() || null;
        const publicId = `SR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        const request = await prisma.supportRequest.create({
            data: {
                publicId,
                userId,
                audience: FaqAudience.PROVIDER,
                category: data.category,
                subject: data.subject.trim(),
                description: data.description.trim(),
                relatedBookingId,
                relatedServiceId,
            },
        });

        const businessName =
            user.providerProfile?.businessProfile?.businessName ||
            user.providerProfile?.contactName ||
            user.phone ||
            "Provider";

        await NotificationsHelper.notifyAdmins({
            type: NotificationType.PROVIDER,
            relatedModule: "support",
            relatedRecordId: request.publicId,
            relatedRoute: "/admin/notifications",
            titleEn: `Provider support: ${request.subject}`,
            titleKm: `គាំទ្រអ្នកផ្តល់សេវា៖ ${request.subject}`,
            messageEn: `${businessName} submitted a ${request.category} support request.`,
            messageKm: `${businessName} បានផ្ញើសំណើគាំទ្រប្រភេទ ${request.category}។`,
        });

        return {
            publicId: request.publicId,
            status: request.status,
        };
    }
}
