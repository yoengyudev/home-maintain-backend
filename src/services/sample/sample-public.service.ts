import type { Prisma } from "../../generated/prisma/client";
import type { Request } from "express";
import { prisma } from "../../database/prisma.client";
import { t } from "../../i18n/translate";
import { BadRequestException, NotFoundException } from "../../utils/app-error.util";
import { getLang } from "../../utils/get-lang.util";
import { buildPaginationMeta, parsePaginationQuery } from "../../utils/pagination.util";

/**
 * Normalizes query values that may come from Express as:
 * - a single string
 * - an array of strings
 * - anything else
 *
 * Returns the first valid string, otherwise `undefined`.
 */
const firstQueryString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }

    return undefined;
};

/**
 * Builds Prisma filter for public sample list.
 * Always excludes soft-deleted rows and optionally applies
 * case-insensitive search on `name` using `search` or `q`.
 */
const buildSampleWhere = (req: Request): Prisma.SampleWhereInput => {
    const where: Prisma.SampleWhereInput = {
        deletedAt: null,
    };

    const searchRaw = firstQueryString(req.query.search) ?? firstQueryString(req.query.q);
    const search = searchRaw?.trim();
    if (search) {
        where.name = { contains: search, mode: "insensitive" };
    }

    return where;
};

/**
 * Reads `req.params.id` and validates it as a non-empty string.
 * Throws localized `BadRequestException` when missing/invalid.
 */
const getSampleIdOrThrow = (req: Request, lang: "en" | "kh") => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
        throw new BadRequestException(t("INVALID_SAMPLE_ID", lang));
    }
    return id;
};

/**
 * Public: returns paginated samples list.
 *
 * No token/role validation is required here.
 * Response shape: `{ data, meta }`.
 */
export const getSamplesPublicService = async (req: Request) => {
    const { page, limit, skip, take } = parsePaginationQuery(req.query.page, req.query.limit);
    const where = buildSampleWhere(req);

    const [samples, total] = await Promise.all([
        prisma.sample.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
        }),
        prisma.sample.count({ where }),
    ]);

    return {
        data: samples,
        meta: buildPaginationMeta(page, limit, total),
    };
};

/**
 * Public: returns a single active sample by id.
 *
 * No token/role validation is required here.
 */
export const getSampleByIdPublicService = async (req: Request) => {
    const lang = getLang(req);
    const id = getSampleIdOrThrow(req, lang);

    const sample = await prisma.sample.findFirst({
        where: {
            id,
            deletedAt: null,
        },
    });

    if (!sample) {
        throw new NotFoundException(t("SAMPLE_NOT_FOUND", lang));
    }

    return sample;
};
