import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminCategoriesService } from "../../services/admin/admin.categories.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listCategories = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCategoriesService.list(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CATEGORIES_RETRIEVED", lang),
        data,
    });
};

export const getCategoryById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminCategoriesService.getById(id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CATEGORY_RETRIEVED", lang),
        data,
    });
};

export const createCategory = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminCategoriesService.create(req.body, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("ADMIN_CATEGORY_CREATED", lang),
        data,
    });
};

export const updateCategory = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCategoriesService.update(id, req.body, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CATEGORY_UPDATED", lang),
        data,
    });
};

export const disableCategory = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCategoriesService.disable(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CATEGORY_DISABLED", lang),
        data,
    });
};

export const restoreCategory = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCategoriesService.restore(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CATEGORY_RESTORED", lang),
        data,
    });
};

export const deleteCategory = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCategoriesService.delete(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CATEGORY_DELETED", lang),
        data,
    });
};
