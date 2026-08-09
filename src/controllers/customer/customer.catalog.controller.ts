import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerCatalogService } from "../../services/customer/customer.catalog.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

const toPositiveNumber = (value: unknown, fallback: number) => {
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return fallback;
};

export const listServiceCategories = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const page = toPositiveNumber(req.query.page, 1);
    const limit = toPositiveNumber(req.query.limit, 50);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const data = await CustomerCatalogService.listServiceCategories(lang, page, limit, search);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};

export const getServiceCategoryById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const data = await CustomerCatalogService.getServiceCategoryById(id, lang);

    if (!data) {
        return res.status(HTTPSTATUS.NOT_FOUND).json({
            success: false,
            message: t("NOT_FOUND", lang),
            data: null,
        });
    }

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};

export const listServices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const page = toPositiveNumber(req.query.page, 1);
    const limit = toPositiveNumber(req.query.limit, 20);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;

    const data = await CustomerCatalogService.listServices(lang, page, limit, search, category);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};

export const getServiceById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const data = await CustomerCatalogService.getServiceById(id, lang);

    if (!data) {
        return res.status(HTTPSTATUS.NOT_FOUND).json({
            success: false,
            message: t("NOT_FOUND", lang),
            data: null,
        });
    }

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};

export const listRecommendedServices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const limit = toPositiveNumber(req.query.limit, 3);
    const data = await CustomerCatalogService.listRecommendedServices(lang, limit);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};

export const listProviders = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const page = toPositiveNumber(req.query.page, 1);
    const limit = toPositiveNumber(req.query.limit, 20);
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;

    const data = await CustomerCatalogService.listProviders(lang, page, limit, search, category);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};

export const getProviderById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const data = await CustomerCatalogService.getProviderById(id, lang);

    if (!data) {
        return res.status(HTTPSTATUS.NOT_FOUND).json({
            success: false,
            message: t("NOT_FOUND", lang),
            data: null,
        });
    }

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};

export const listRecommendedProviders = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const limit = toPositiveNumber(req.query.limit, 3);
    const data = await CustomerCatalogService.listRecommendedProviders(lang, limit);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SUCCESS", lang),
        data,
    });
};
