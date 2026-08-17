import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { SupportPageKey } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import {
    CUSTOMER_CONTACT_DEFAULT,
    CUSTOMER_ABOUT_DEFAULT_EN,
    CUSTOMER_ABOUT_DEFAULT_KM,
    CUSTOMER_MISSION_DEFAULT_EN,
    CUSTOMER_MISSION_DEFAULT_KM,
} from "./customer.support.seed";

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

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export class CustomerSupportService {
    static async getAbout(lang: Lang) {
        await this.ensurePage(
            SupportPageKey.ABOUT,
            CUSTOMER_ABOUT_DEFAULT_EN,
            CUSTOMER_ABOUT_DEFAULT_KM
        );
        return this.getPageContent<AboutContent>(
            SupportPageKey.ABOUT,
            lang,
            lang === "kh" ? CUSTOMER_ABOUT_DEFAULT_KM : CUSTOMER_ABOUT_DEFAULT_EN
        );
    }

    static async getMission(lang: Lang) {
        await this.ensurePage(
            SupportPageKey.MISSION,
            CUSTOMER_MISSION_DEFAULT_EN,
            CUSTOMER_MISSION_DEFAULT_KM
        );
        return this.getPageContent<MissionContent>(
            SupportPageKey.MISSION,
            lang,
            lang === "kh" ? CUSTOMER_MISSION_DEFAULT_KM : CUSTOMER_MISSION_DEFAULT_EN
        );
    }

    static async getContact(lang: Lang) {
        await this.ensurePage(
            SupportPageKey.CUSTOMER_CONTACT,
            CUSTOMER_CONTACT_DEFAULT,
            CUSTOMER_CONTACT_DEFAULT
        );

        const page = await prisma.supportPage.findFirst({
            where: {
                pageKey: SupportPageKey.CUSTOMER_CONTACT,
                isActive: true,
            },
        });

        const raw = page
            ? asRecord(lang === "kh" ? page.contentKm : page.contentEn)
            : CUSTOMER_CONTACT_DEFAULT;

        const rawEn = (page ? asRecord(page.contentEn) : CUSTOMER_CONTACT_DEFAULT) as Record<string, any>;
        const rawKm = (page ? asRecord(page.contentKm) : CUSTOMER_CONTACT_DEFAULT) as Record<string, any>;

        const phone = String(raw.phone || rawEn.phone || CUSTOMER_CONTACT_DEFAULT.phone).trim();
        const phoneDisplay = String(
            raw.phoneDisplay || rawEn.phoneDisplay || raw.phone || rawEn.phone || CUSTOMER_CONTACT_DEFAULT.phoneDisplay
        ).trim();

        const address =
            lang === "kh"
                ? String(
                      rawKm.addressKm ||
                          rawKm.address ||
                          rawEn.addressEn ||
                          rawEn.address ||
                          CUSTOMER_CONTACT_DEFAULT.addressKm
                  )
                : String(
                      rawEn.addressEn ||
                          rawEn.address ||
                          rawKm.addressKm ||
                          rawKm.address ||
                          CUSTOMER_CONTACT_DEFAULT.addressEn
                  );

        const companyName = String(
            raw.companyName || rawEn.companyName || rawKm.companyName || CUSTOMER_CONTACT_DEFAULT.companyName
        ).trim();

        return {
            publicId: page?.publicId || "customer-contact-default",
            pageKey: SupportPageKey.CUSTOMER_CONTACT,
            companyName,
            address,
            addressEn: String(rawEn.addressEn || rawEn.address || CUSTOMER_CONTACT_DEFAULT.addressEn),
            addressKm: String(rawKm.addressKm || rawKm.address || CUSTOMER_CONTACT_DEFAULT.addressKm),
            telegramHandle: String(raw.telegramHandle || rawEn.telegramHandle || CUSTOMER_CONTACT_DEFAULT.telegramHandle),
            telegramUrl: String(raw.telegramUrl || rawEn.telegramUrl || CUSTOMER_CONTACT_DEFAULT.telegramUrl),
            phone,
            phoneDisplay,
            email: String(raw.email || rawEn.email || CUSTOMER_CONTACT_DEFAULT.email),
            hours:
                lang === "kh"
                    ? String(rawKm.hoursKm || raw.hoursKm || CUSTOMER_CONTACT_DEFAULT.hoursKm)
                    : String(rawEn.hoursEn || raw.hoursEn || CUSTOMER_CONTACT_DEFAULT.hoursEn),
            hoursEn: String(rawEn.hoursEn || CUSTOMER_CONTACT_DEFAULT.hoursEn),
            hoursKm: String(rawKm.hoursKm || CUSTOMER_CONTACT_DEFAULT.hoursKm),
        } satisfies {
            publicId: string;
            pageKey: typeof SupportPageKey.CUSTOMER_CONTACT;
            companyName: string;
            address: string;
            addressEn: string;
            addressKm: string;
            telegramHandle: string;
            telegramUrl: string;
            phone: string;
            phoneDisplay: string;
            email: string;
            hours: string;
            hoursEn: string;
            hoursKm: string;
        };
    }

    /** Ensure customer contact page exists so admin can edit it. */
    static async ensureCustomerContactPage() {
        return this.ensurePage(
            SupportPageKey.CUSTOMER_CONTACT,
            CUSTOMER_CONTACT_DEFAULT,
            CUSTOMER_CONTACT_DEFAULT
        );
    }

    private static async ensurePage(
        pageKey: SupportPageKey,
        defaultEn: Record<string, any>,
        defaultKm: Record<string, any>
    ) {
        try {
            const existing = await prisma.supportPage.findUnique({
                where: { pageKey },
            });
            if (existing) return existing;

            return await prisma.supportPage.create({
                data: {
                    publicId: crypto.randomUUID(),
                    pageKey,
                    contentEn: defaultEn,
                    contentKm: defaultKm,
                    isActive: true,
                },
            });
        } catch {
            return null;
        }
    }

    private static async getPageContent<T>(
        pageKey: SupportPageKey,
        lang: Lang,
        fallbackDefault: Record<string, any>
    ) {
        const page = await prisma.supportPage.findFirst({
            where: {
                pageKey,
                isActive: true,
            },
        });

        const isKh = lang === "kh";
        const content = (page ? (isKh ? page.contentKm : page.contentEn) : fallbackDefault) as T;

        return {
            publicId: page?.publicId || `${pageKey.toLowerCase()}-default`,
            pageKey,
            ...(typeof content === "object" && content !== null ? content : fallbackDefault),
        };
    }
}
