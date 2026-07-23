import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminServicesService } from "../../services/admin/admin.services.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listServices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminServicesService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Services retrieved", data });
};

export const getServiceById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const data = await AdminServicesService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service retrieved", data });
};

export const disableService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.disable(id, reason, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service disabled", data });
};

export const restoreService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.restore(id, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service restored", data });
};
