import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorVerificationService } from "../../services/vendor/vendor.Verification.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getDraft = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.getDraftVerification(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_VERIFICATION_DRAFT_RETRIEVED", lang),
        data,
    });
};

export const saveDraft = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.saveDraftVerification(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_VERIFICATION_DRAFT_SAVED", lang),
        data,
    });
};

export const submit = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.submitVerification(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("VENDOR_VERIFICATION_SUBMITTED", lang),
        data,
    });
};

export const getStatus = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.getVerificationStatus(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_VERIFICATION_STATUS_RETRIEVED", lang),
        data,
    });
};

export const updateForChanges = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.updateVerificationForChanges(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_VERIFICATION_UPDATED", lang),
        data,
    });
};

export const deleteDraft = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.deleteDraftVerification(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_VERIFICATION_DRAFT_DELETED", lang),
        data,
    });
};
