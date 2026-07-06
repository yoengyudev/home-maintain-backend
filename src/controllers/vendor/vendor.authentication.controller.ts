import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorAuthenticationService } from "../../services/vendor/vendor.authentication.service";
import { sendResponse } from "../../utils/response.util";

export const register = async (req: Request, res: Response) => {
    const data = await VendorAuthenticationService.register(req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: "Provider registered successfully",
        data,
    });
};

export const login = async (req: Request, res: Response) => {
    const data = await VendorAuthenticationService.login(req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Logged in successfully",
        data,
    });
};

export const forgotPassword = async (req: Request, res: Response) => {
    const data = await VendorAuthenticationService.forgotPassword(req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Password reset OTP sent",
        data,
    });
};

export const resetPassword = async (req: Request, res: Response) => {
    const data = await VendorAuthenticationService.resetPassword(req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Password has been reset successfully",
        data,
    });
};

export const logout = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const authHeader = req.headers.authorization;

    if (userId && authHeader) {
        await VendorAuthenticationService.logout(userId, authHeader);
    }

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Logged out successfully",
    });
};

export const me = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorAuthenticationService.me(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Provider profile retrieved successfully",
        data,
    });
};
