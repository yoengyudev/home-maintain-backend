import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorBookingsService } from "../../services/vendor/vendor.bookings.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listBookings = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorBookingsService.list(userId, req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_BOOKINGS_RETRIEVED", lang),
        data,
    });
};

export const getBookingById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.getById(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_BOOKING_RETRIEVED", lang),
        data,
    });
};

export const acceptBooking = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.accept(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_BOOKING_ACCEPTED", lang),
        data,
    });
};

export const rejectBooking = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const data = await VendorBookingsService.reject(userId, id, reason, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_BOOKING_REJECTED", lang),
        data,
    });
};

export const startBooking = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.start(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_BOOKING_STARTED", lang),
        data,
    });
};

export const completeBooking = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.complete(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_BOOKING_COMPLETED", lang),
        data,
    });
};
