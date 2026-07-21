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

export const getCategoryById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = String(req.params.id ?? "");
    const data = await CustomerServiceCategoriesService.getCategoryById(id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_CATEGORY_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};
