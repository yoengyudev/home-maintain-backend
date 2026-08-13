import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminAuthenticationService } from "../../services/admin/admin.authentication.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const login = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminAuthenticationService.login(req.body, lang, {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip,
    });

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_LOGGED_IN_SUCCESSFULLY", lang),
        data,
    });
};

export const refresh = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminAuthenticationService.refresh(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_TOKEN_REFRESHED", lang),
        data,
    });
};

export const logout = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const user = (req as any).user;
    if (user?.userId) {
        await AdminAuthenticationService.logout(user.userId, lang, user?.sid);
    }
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_LOGGED_OUT_SUCCESSFULLY", lang),
    });
};

export const forgotPassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminAuthenticationService.forgotPassword(req.body.email, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_OTP_SENT", lang),
        data,
    });
};

export const verifyResetOtp = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminAuthenticationService.verifyResetOtp(req.body.email, req.body.otp, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_OTP_VERIFIED", lang),
        data,
    });
};

export const resetPassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminAuthenticationService.resetPassword(
        req.body.email,
        req.body.otp,
        req.body.newPassword,
        lang
    );
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_PASSWORD_RESET", lang),
        data,
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
