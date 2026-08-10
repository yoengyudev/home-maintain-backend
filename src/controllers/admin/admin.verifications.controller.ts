import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminVerificationsService } from "../../services/admin/admin.verifications.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listVerifications = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminVerificationsService.list(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_VERIFICATIONS_RETRIEVED", lang),
        data,
    });
};

export const getVerificationById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminVerificationsService.getById(id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_VERIFICATION_RETRIEVED", lang),
        data,
    });
};

export const approveVerification = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { notes } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminVerificationsService.approve(id, notes, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_VERIFICATION_APPROVED", lang),
        data,
    });
};

export const requestChanges = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminVerificationsService.requestChanges(id, reason, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_VERIFICATION_CHANGES_REQUESTED", lang),
        data,
    });
};

export const rejectVerification = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminVerificationsService.reject(id, reason, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_VERIFICATION_REJECTED", lang),
        data,
    });
};
