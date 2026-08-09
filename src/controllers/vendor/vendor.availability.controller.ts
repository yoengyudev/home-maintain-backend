import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorAvailabilityService } from "../../services/vendor/vendor.availability.service";
import { sendResponse } from "../../utils/response.util";

export const getAvailability = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorAvailabilityService.getAvailability(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Availability retrieved successfully",
        data,
    });
};

export const updateAvailability = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorAvailabilityService.updateAvailability(userId, req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Availability updated successfully",
        data,
    });
};
