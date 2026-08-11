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
import { PROVIDER_CONTACT_DEFAULT, PROVIDER_FAQ_SEEDS } from "./vendor.help.seed";
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
        await this.ensureProviderHelpContent();

        const [faqs, contactPage] = await Promise.all([
            prisma.faq.findMany({
                where: {
                    audience: FaqAudience.PROVIDER,
                    isActive: true,
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

        const contactRaw = (contactPage
            ? ((lang === "kh" ? contactPage.contentKm : contactPage.contentEn) as ContactContent)
            : PROVIDER_CONTACT_DEFAULT);

        const hours =
            ("hours" in contactRaw && contactRaw.hours) ||
            (lang === "kh"
                ? contactRaw.hoursKm || PROVIDER_CONTACT_DEFAULT.hoursKm
                : contactRaw.hoursEn || PROVIDER_CONTACT_DEFAULT.hoursEn);

        return {
            contact: {
                telegramHandle: contactRaw.telegramHandle || PROVIDER_CONTACT_DEFAULT.telegramHandle,
                telegramUrl: contactRaw.telegramUrl || PROVIDER_CONTACT_DEFAULT.telegramUrl,
                phone: contactRaw.phone || PROVIDER_CONTACT_DEFAULT.phone,
                phoneDisplay: contactRaw.phoneDisplay || PROVIDER_CONTACT_DEFAULT.phoneDisplay,
                email: contactRaw.email || PROVIDER_CONTACT_DEFAULT.email,
                hours,
            },
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

    private static async ensureProviderHelpContent() {
        const [faqCount, contact] = await Promise.all([
            prisma.faq.count({
                where: { audience: FaqAudience.PROVIDER },
            }),
            prisma.supportPage.findFirst({
                where: { pageKey: SupportPageKey.PROVIDER_CONTACT },
            }),
        ]);

        if (faqCount === 0) {
            await prisma.faq.createMany({
                data: PROVIDER_FAQ_SEEDS.map((faq) => ({
                    publicId: faq.publicId,
                    audience: FaqAudience.PROVIDER,
                    category: faq.category,
                    questionEn: faq.questionEn,
                    questionKm: faq.questionKm,
                    answerEn: faq.answerEn,
                    answerKm: faq.answerKm,
                    keywords: faq.keywords,
                    relatedRoute: faq.relatedRoute ?? null,
                    relatedRouteLabelEn: faq.relatedRouteLabelEn ?? null,
                    relatedRouteLabelKm: faq.relatedRouteLabelKm ?? null,
                    sortOrder: faq.sortOrder,
                    isActive: true,
                })),
                skipDuplicates: true,
            });
        }

        if (!contact) {
            await prisma.supportPage.create({
                data: {
                    publicId: "support-provider-contact",
                    pageKey: SupportPageKey.PROVIDER_CONTACT,
                    isActive: true,
                    contentEn: PROVIDER_CONTACT_DEFAULT,
                    contentKm: PROVIDER_CONTACT_DEFAULT,
                },
            });
        }
    }
}
