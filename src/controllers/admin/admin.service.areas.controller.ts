import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminServiceAreasService } from "../../services/admin/admin.service.areas.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listServiceAreas = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminServiceAreasService.list(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_AREAS_RETRIEVED", lang),
        data,
    });
};

export const getServiceAreaById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminServiceAreasService.getById(id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_AREA_RETRIEVED", lang),
        data,
    });
};

export const createServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.create(req.body, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("ADMIN_SERVICE_AREA_CREATED", lang),
        data,
    });
};

export const updateServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.update(id, req.body, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_AREA_UPDATED", lang),
        data,
    });
};

export const disableServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.disable(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_AREA_DISABLED", lang),
        data,
    });
};

export const restoreServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.restore(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_AREA_RESTORED", lang),
        data,
    });
};

export const deleteServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.delete(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_AREA_DELETED", lang),
        data,
    });
};
