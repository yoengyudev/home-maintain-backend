import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminServiceAreasService } from "../../services/admin/admin.service.areas.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listServiceAreas = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminServiceAreasService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service areas retrieved", data });
};

export const getServiceAreaById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminServiceAreasService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service area retrieved", data });
};

export const createServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.create(req.body, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.CREATED, message: "Service area created", data });
};

export const updateServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.update(id, req.body, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service area updated", data });
};

export const disableServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.disable(id, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service area disabled", data });
};

export const restoreServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.restore(id, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service area restored", data });
};

export const deleteServiceArea = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminServiceAreasService.delete(id, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Service area deleted", data });
};

