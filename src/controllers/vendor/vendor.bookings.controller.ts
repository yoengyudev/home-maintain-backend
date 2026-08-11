import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorBookingsService } from "../../services/vendor/vendor.bookings.service";
import { sendResponse } from "../../utils/response.util";

export const listBookings = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorBookingsService.list(userId, req.query);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Bookings retrieved successfully",
        data,
    });
};

export const getBookingById = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.getById(userId, id);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Booking retrieved successfully",
        data,
    });
};

export const acceptBooking = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.accept(userId, id);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Booking accepted successfully",
        data,
    });
};

export const rejectBooking = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const data = await VendorBookingsService.reject(userId, id, reason);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Booking rejected successfully",
        data,
    });
};

export const startBooking = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.start(userId, id);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service started successfully",
        data,
    });
};

export const completeBooking = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorBookingsService.complete(userId, id);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service completed successfully",
        data,
    });
};
