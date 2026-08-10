import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminProfileService } from "../../services/admin/admin.profile.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user.userId;
    const data = await AdminProfileService.getProfile(userId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_PROFILE_RETRIEVED", lang),
        data,
    });
};

export const updateProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user.userId;
    const data = await AdminProfileService.updateProfile(userId, req.body, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_PROFILE_UPDATED", lang),
        data,
    });
};

export const changePassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;
    const data = await AdminProfileService.changePassword(userId, currentPassword, newPassword, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_PASSWORD_CHANGED", lang),
        data,
    });
};
