import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerProfileService } from "../../services/customer/customer.profile.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerProfileService.getProfile(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_PROFILE_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getProfileStats = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerProfileService.getProfileStats(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_PROFILE_STATS_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const updateProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const avatarFile = files?.avatar?.[0] ?? files?.avatarUrl?.[0] ?? req.file;

    const data = await CustomerProfileService.updateProfile(
        userId,
        req.body,
        avatarFile,
        lang
    );

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_PROFILE_UPDATED_SUCCESSFULLY", lang),
        data,
    });
};
