import { prisma } from "../../database/prisma.client";
import type { Lang } from "../../i18n/messages";
import {
    buildPaginationMeta,
    firstQueryString,
    parsePaginationQuery,
} from "../../utils/pagination.util";

export class CustomerFaqsService {
    static async listFaqs(
        query: { page?: unknown; limit?: unknown; search?: unknown },
        lang: Lang
    ) {
        const { page, limit, skip, take } = parsePaginationQuery(query.page, query.limit);
        const search = firstQueryString(query.search)?.trim() ?? "";

        const where = {
            isActive: true,
            ...(search
                ? {
                      OR: [
                          { questionEn: { contains: search, mode: "insensitive" as const } },
                          { questionKm: { contains: search, mode: "insensitive" as const } },
                          { answerEn: { contains: search, mode: "insensitive" as const } },
                          { answerKm: { contains: search, mode: "insensitive" as const } },
                      ],
                  }
                : {}),
        };

        const [faqs, total] = await Promise.all([
            prisma.faq.findMany({
                where,
                skip,
                take,
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            }),
            prisma.faq.count({ where }),
        ]);

        return {
            data: faqs.map((faq) => this.formatFaq(faq, lang)),
            meta: buildPaginationMeta(page, limit, total),
        };
    }

    private static formatFaq(
        faq: {
            publicId: string;
            questionEn: string;
            questionKm: string;
            answerEn: string;
            answerKm: string;
            sortOrder: number;
        },
        lang: Lang
    ) {
        const isKh = lang === "kh";

        return {
            publicId: faq.publicId,
            question: isKh ? faq.questionKm : faq.questionEn,
            answer: isKh ? faq.answerKm : faq.answerEn,
            questionEn: faq.questionEn,
            questionKm: faq.questionKm,
            answerEn: faq.answerEn,
            answerKm: faq.answerKm,
            sortOrder: faq.sortOrder,
        };
    }
}
