import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminNotificationsService } from "../../services/admin/admin.notifications.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listNotifications = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminNotificationsService.list(adminUserId, req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_NOTIFICATIONS_RETRIEVED", lang),
        data,
    });
};

export const getUnreadCount = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminNotificationsService.unreadCount(adminUserId);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_NOTIFICATION_UNREAD_COUNT_RETRIEVED", lang),
        data,
    });
};

export const markRead = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminNotificationsService.markRead(adminUserId, id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_NOTIFICATION_MARKED_READ", lang),
        data,
    });
};

export const markAllRead = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    await AdminNotificationsService.markAllRead(adminUserId);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_NOTIFICATIONS_MARKED_READ", lang),
    });
};
