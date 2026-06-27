export const getPagination = (page = 1, limit = 10) => {
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    return { skip, take };
};

export const parsePaginationQuery = (
    page?: unknown,
    limit?: unknown,
    maxLimit = 100
) => {
    const parsedPage = Number(page ?? 1);
    const parsedLimit = Number(limit ?? 10);

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
    totalPages: Math.ceil(total / limit),
});