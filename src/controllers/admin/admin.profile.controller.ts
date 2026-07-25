import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminProfileService } from "../../services/admin/admin.profile.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const getProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user.userId;
    const data = await AdminProfileService.getProfile(userId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Profile retrieved", data });
};

export const updateProfile = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user.userId;
    const data = await AdminProfileService.updateProfile(userId, req.body, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Profile updated", data });
};

export const changePassword = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;
    const data = await AdminProfileService.changePassword(userId, currentPassword, newPassword, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Password changed successfully", data });
};
