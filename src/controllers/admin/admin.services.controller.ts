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
    const id = req.params.id as string;
    const data = await AdminServicesService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service retrieved", data });
};

export const disableService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.disable(id, reason, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service disabled", data });
};

export const restoreService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.restore(id, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service restored", data });
};

export const approveService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { note } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.approve(id, note, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service approved", data });
};

export const requestServiceChanges = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { reason, note } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServicesService.requestChanges(id, reason, note, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Changes requested", data });
};

