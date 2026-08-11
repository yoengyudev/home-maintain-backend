import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorAuthenticationService } from "../../services/vendor/vendor.authentication.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const register = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorAuthenticationService.register(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("VENDOR_REGISTERED_SUCCESSFULLY", lang),
        data,
    });
};

export const getProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorAuthenticationService.me(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_PROFILE_RETRIEVED", lang),
        data,
    });
};

export const login = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorAuthenticationService.login(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_LOGGED_IN_SUCCESSFULLY", lang),
        data,
    });
};

export const forgotPassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorAuthenticationService.forgotPassword(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_OTP_SENT", lang),
        data,
    });
};

export const resetPassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorAuthenticationService.resetPassword(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_PASSWORD_RESET_SUCCESSFULLY", lang),
        data,
    });
};

export const logout = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const authHeader = req.headers.authorization;

    if (userId && authHeader) {
        await VendorAuthenticationService.logout(userId, authHeader);
    }

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_LOGGED_OUT_SUCCESSFULLY", lang),
    });
};

export const me = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorAuthenticationService.me(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_PROFILE_RETRIEVED", lang),
        data,
    });
};

export const updateProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorAuthenticationService.updateProfile(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_PROFILE_UPDATED", lang),
        data,
    });
};

export const updateAvailability = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorAuthenticationService.updateAvailability(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_AVAILABILITY_UPDATED", lang),
        data,
    });
};
