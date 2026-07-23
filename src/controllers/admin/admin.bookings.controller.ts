import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminBookingsService } from "../../services/admin/admin.bookings.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listBookings = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminBookingsService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Bookings retrieved", data });
};

export const getBookingById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const data = await AdminBookingsService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Booking retrieved", data });
};
