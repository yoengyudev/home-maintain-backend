import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerBookingsService } from "../../services/customer/customer.bookings.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listBookings = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerBookingsService.list(userId, req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_BOOKINGS_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getBookingByPublicId = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const publicId = String(req.params.publicId ?? "");
    const data = await CustomerBookingsService.getByPublicId(userId, publicId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_BOOKING_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const createBooking = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerBookingsService.create(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("CUSTOMER_BOOKING_CREATED_SUCCESSFULLY", lang),
        data,
    });
};

export const cancelBooking = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const publicId = String(req.params.publicId ?? "");
    const data = await CustomerBookingsService.cancel(userId, publicId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_BOOKING_CANCELLED_SUCCESSFULLY", lang),
        data,
    });
};

export const rescheduleBooking = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const publicId = String(req.params.publicId ?? "");
    const data = await CustomerBookingsService.reschedule(userId, publicId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_BOOKING_RESCHEDULED_SUCCESSFULLY", lang),
        data,
    });
};
