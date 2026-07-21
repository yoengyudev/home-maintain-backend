import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerServiceCategoriesService } from "../../services/customer/customer.service.categories.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getCategories = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerServiceCategoriesService.getCategories(req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_CATEGORIES_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getCategoryBySlug = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const slug = String(req.params.slug ?? "");
    const data = await CustomerServiceCategoriesService.getCategoryBySlug(slug, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_CATEGORY_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};
