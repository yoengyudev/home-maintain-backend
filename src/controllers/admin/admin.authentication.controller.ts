import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminAuthenticationService } from "../../services/admin/admin.authentication.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const login = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { email, password } = req.body;
    const data = await AdminAuthenticationService.login(email, password, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Logged in successfully",
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
        message: "Logged out successfully",
    });
};

export const me = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const user = (req as any).user;
    const data = await AdminAuthenticationService.me(user.userId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Admin profile retrieved",
        data,
    });
};
