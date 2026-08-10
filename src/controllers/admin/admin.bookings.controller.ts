import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminBookingsService } from "../../services/admin/admin.bookings.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listBookings = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminBookingsService.list(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_BOOKINGS_RETRIEVED", lang),
        data,
    });
};

export const getBookingById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminBookingsService.getById(id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_BOOKING_RETRIEVED", lang),
        data,
    });
};
