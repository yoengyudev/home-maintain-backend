import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminProvidersService } from "../../services/admin/admin.providers.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listProviders = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminProvidersService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Providers retrieved", data });
};

export const getProviderById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const data = await AdminProvidersService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Provider retrieved", data });
};

export const suspendProvider = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminProvidersService.suspend(id, reason, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Provider suspended", data });
};

export const restoreProvider = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const adminUserId = (req as any).user.userId;
    const data = await AdminProvidersService.restore(id, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Provider restored", data });
};
