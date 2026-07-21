export const getPagination = (page = 1, limit = 10) => {
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    return { skip, take };
};

/**
 * Normalizes query values that may come from Express as:
 * - a single string
 * - an array of strings
 * - anything else
 */
export const firstQueryString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }

    return undefined;
};

export const parsePaginationQuery = (
    page?: unknown,
    limit?: unknown,
    maxLimit = 100
) => {
    const pageRaw = firstQueryString(page) ?? page;
    const limitRaw = firstQueryString(limit) ?? limit;

    const parsedPage = Number(pageRaw ?? 1);
    const parsedLimit = Number(limitRaw ?? 10);

    const normalizedPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const normalizedLimit =
        Number.isNaN(parsedLimit) || parsedLimit < 1
            ? 10
            : Math.min(parsedLimit, maxLimit);

    return {
        page: normalizedPage,
        limit: normalizedLimit,
        ...getPagination(normalizedPage, normalizedLimit),
    };
};

export const buildPaginationMeta = (
    page: number,
    limit: number,
    total: number
) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
});
