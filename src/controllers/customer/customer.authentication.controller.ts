import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerAuthenticationService } from "../../services/customer/customer.authentication.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const register = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.register(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_OTP_SENT_SUCCESSFULLY", lang),
        data,
    });
};

export const verifyRegisterOtp = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.verifyRegisterOtp(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("CUSTOMER_REGISTERED_SUCCESSFULLY", lang),
        data,
    });
};

export const resendRegisterOtp = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.resendRegisterOtp(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_OTP_RESENT_SUCCESSFULLY", lang),
        data,
    });
};

export const forgotPassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.forgotPassword(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_FORGOT_PASSWORD_OTP_SENT", lang),
        data,
    });
};

export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.verifyForgotPasswordOtp(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_FORGOT_PASSWORD_OTP_VERIFIED", lang),
        data,
    });
};

export const resendForgotPasswordOtp = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.resendForgotPasswordOtp(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_OTP_RESENT_SUCCESSFULLY", lang),
        data,
    });
};

export const resetPassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.resetPassword(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_PASSWORD_RESET_SUCCESSFULLY", lang),
        data,
    });
};

export const login = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerAuthenticationService.login(req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_LOGGED_IN_SUCCESSFULLY", lang),
        data,
    });
};

export const logout = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const user = (req as any).user;
    const userId = user?.userId;
    const sessionId = user?.sid;

    if (userId) {
        await CustomerAuthenticationService.logout(userId, sessionId);
    }

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_LOGGED_OUT_SUCCESSFULLY", lang),
    });
};
