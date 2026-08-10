import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminServicesService } from "../../services/admin/admin.services.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listServices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminServicesService.list(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICES_RETRIEVED", lang),
        data,
    });
};

export const getServiceById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminServicesService.getById(id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_RETRIEVED", lang),
        data,
    });
};

export const disableService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.disable(id, reason, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_DISABLED", lang),
        data,
    });
};

export const restoreService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.restore(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_RESTORED", lang),
        data,
    });
};

export const approveService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { note } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.approve(id, note, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_APPROVED", lang),
        data,
    });
};

export const requestServiceChanges = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { reason, note } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.requestChanges(id, reason, note, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SERVICE_CHANGES_REQUESTED", lang),
        data,
    });
};
