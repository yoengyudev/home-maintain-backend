import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminAuthenticationService } from "../../services/admin/admin.authentication.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const login = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminAuthenticationService.login(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_LOGGED_IN_SUCCESSFULLY", lang),
        data,
    });
};

export const logout = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const user = (req as any).user;
    if (user?.userId) {
        await AdminAuthenticationService.logout(user.userId, lang);
    }
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_LOGGED_OUT_SUCCESSFULLY", lang),
    });
};

export const me = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const user = (req as any).user;
    const data = await AdminAuthenticationService.me(user.userId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_ME_RETRIEVED", lang),
        data,
    });
};
