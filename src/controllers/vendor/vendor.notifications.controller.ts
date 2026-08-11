import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorNotificationsService } from "../../services/vendor/vendor.notifications.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listNotifications = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorNotificationsService.list(userId, req.query);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_NOTIFICATIONS_RETRIEVED", lang),
        data,
    });
};

export const markNotificationRead = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorNotificationsService.markRead(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_NOTIFICATION_MARKED_READ", lang),
        data,
    });
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorNotificationsService.markAllRead(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_NOTIFICATIONS_MARKED_READ", lang),
        data,
    });
};
