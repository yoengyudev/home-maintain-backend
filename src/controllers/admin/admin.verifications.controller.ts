import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminVerificationsService } from "../../services/admin/admin.verifications.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listVerifications = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminVerificationsService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Verifications retrieved", data });
};

export const getVerificationById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const data = await AdminVerificationsService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Verification retrieved", data });
};

export const approveVerification = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const { notes } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminVerificationsService.approve(id, notes, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Verification approved", data });
};

export const requestChanges = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminVerificationsService.requestChanges(id, reason, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Verification changes requested", data });
};

export const rejectVerification = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminVerificationsService.reject(id, reason, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Verification rejected", data });
};
