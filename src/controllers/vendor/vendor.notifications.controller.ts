import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorNotificationsService } from "../../services/vendor/vendor.notifications.service";
import { sendResponse } from "../../utils/response.util";

export const listNotifications = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorNotificationsService.list(userId, req.query);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Notifications retrieved successfully",
        data,
    });
};
