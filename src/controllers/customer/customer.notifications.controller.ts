import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerNotificationsService } from "../../services/customer/customer.notifications.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listNotifications = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerNotificationsService.list(userId, req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_NOTIFICATIONS_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getUnreadNotificationCount = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerNotificationsService.unreadCount(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_NOTIFICATIONS_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const markNotificationRead = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await CustomerNotificationsService.markRead(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_NOTIFICATION_MARKED_READ_SUCCESSFULLY", lang),
        data,
    });
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerNotificationsService.markAllRead(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_NOTIFICATIONS_MARKED_READ_SUCCESSFULLY", lang),
        data,
    });
};
