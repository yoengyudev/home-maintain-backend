import { prisma } from "../../database/prisma.client";
import { SupportPageKey } from "../../generated/prisma/enums";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import { NotFoundException } from "../../utils/app-error.util";

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

export class CustomerSupportService {
    static async getAbout(lang: Lang) {
        return this.getPageContent<AboutContent>(SupportPageKey.ABOUT, lang);
    }

    static async getMission(lang: Lang) {
        return this.getPageContent<MissionContent>(SupportPageKey.MISSION, lang);
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
