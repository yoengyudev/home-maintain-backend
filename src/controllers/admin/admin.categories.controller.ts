import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminCategoriesService } from "../../services/admin/admin.categories.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listCategories = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCategoriesService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Categories retrieved", data });
};

export const getCategoryById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const data = await AdminCategoriesService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Category retrieved", data });
};

export const createCategory = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminCategoriesService.create(req.body, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.CREATED, message: "Category created", data });
};

export const updateCategory = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCategoriesService.update(id, req.body, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Category updated", data });
};
