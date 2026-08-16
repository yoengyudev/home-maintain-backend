import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { SupportPageKey } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { NotFoundException } from "../../utils/app-error.util";
import { CUSTOMER_CONTACT_DEFAULT } from "./customer.support.seed";

type AboutContent = {
    eyebrow: string;
    title: string;
    descriptionOne: string;
    descriptionTwo: string;
    trustTitle: string;
    trustDescription: string;
    trustItems: string[];
    learnMissionLabel: string;
};

type MissionValue = {
    icon: string;
    title: string;
    description: string;
};

type MissionContent = {
    statementLabel: string;
    title: string;
    description: string;
    valuesTitle: string;
    values: MissionValue[];
    qualityTitle: string;
    qualityDescription: string;
};

type ContactContent = {
    telegramHandle: string;
    telegramUrl: string;
    phone: string;
    phoneDisplay: string;
    email: string;
    hoursEn: string;
    hoursKm: string;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export class CustomerSupportService {
    static async getAbout(lang: Lang) {
        return this.getPageContent<AboutContent>(SupportPageKey.ABOUT, lang);
    }

    static async getMission(lang: Lang) {
        return this.getPageContent<MissionContent>(SupportPageKey.MISSION, lang);
    }

    static async getContact(lang: Lang) {
        const page = await prisma.supportPage.findFirst({
            where: {
                pageKey: SupportPageKey.CUSTOMER_CONTACT,
                isActive: true,
            },
        });

        const raw = page
            ? asRecord(lang === "kh" ? page.contentKm : page.contentEn)
            : CUSTOMER_CONTACT_DEFAULT;

        const phone = String(raw.phone || CUSTOMER_CONTACT_DEFAULT.phone).trim();
        const phoneDisplay = String(
            raw.phoneDisplay || raw.phone || CUSTOMER_CONTACT_DEFAULT.phoneDisplay
        ).trim();

        return {
            publicId: page?.publicId || "customer-contact-default",
            pageKey: SupportPageKey.CUSTOMER_CONTACT,
            telegramHandle: String(raw.telegramHandle || CUSTOMER_CONTACT_DEFAULT.telegramHandle),
            telegramUrl: String(raw.telegramUrl || CUSTOMER_CONTACT_DEFAULT.telegramUrl),
            phone,
            phoneDisplay,
            email: String(raw.email || CUSTOMER_CONTACT_DEFAULT.email),
            hours:
                lang === "kh"
                    ? String(raw.hoursKm || CUSTOMER_CONTACT_DEFAULT.hoursKm)
                    : String(raw.hoursEn || CUSTOMER_CONTACT_DEFAULT.hoursEn),
        } satisfies {
            publicId: string;
            pageKey: typeof SupportPageKey.CUSTOMER_CONTACT;
            telegramHandle: string;
            telegramUrl: string;
            phone: string;
            phoneDisplay: string;
            email: string;
            hours: string;
        };
    }

    /** Ensure the customer contact page exists so admin can edit it. */
    static async ensureCustomerContactPage() {
        const existing = await prisma.supportPage.findUnique({
            where: { pageKey: SupportPageKey.CUSTOMER_CONTACT },
        });
        if (existing) return existing;

        return prisma.supportPage.create({
            data: {
                publicId: crypto.randomUUID(),
                pageKey: SupportPageKey.CUSTOMER_CONTACT,
                contentEn: CUSTOMER_CONTACT_DEFAULT,
                contentKm: CUSTOMER_CONTACT_DEFAULT,
                isActive: true,
            },
        });
    }

    private static async getPageContent<T>(pageKey: SupportPageKey, lang: Lang) {
        const page = await prisma.supportPage.findFirst({
            where: {
                pageKey,
                isActive: true,
            },
        });

        if (!page) {
            throw new NotFoundException(t("CUSTOMER_SUPPORT_PAGE_NOT_FOUND", lang));
        }

        const isKh = lang === "kh";
        const content = (isKh ? page.contentKm : page.contentEn) as T;

        return {
            publicId: page.publicId,
            pageKey: page.pageKey,
            ...content,
        };
    }
}
