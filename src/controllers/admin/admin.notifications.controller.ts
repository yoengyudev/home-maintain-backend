import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminNotificationsService } from "../../services/admin/admin.notifications.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listNotifications = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminNotificationsService.list(adminUserId, req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Notifications retrieved", data });
};

export const getUnreadCount = async (req: Request, res: Response) => {
    const adminUserId = (req as any).user.userId;
    const data = await AdminNotificationsService.unreadCount(adminUserId);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Unread count retrieved", data });
};

export const markRead = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const adminUserId = (req as any).user.userId;
    const data = await AdminNotificationsService.markRead(adminUserId, id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Notification marked read", data });
};

export const markAllRead = async (req: Request, res: Response) => {
    const adminUserId = (req as any).user.userId;
    await AdminNotificationsService.markAllRead(adminUserId);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "All notifications marked read" });
};
