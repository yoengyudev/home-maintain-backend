import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorReviewsService } from "../../services/vendor/vendor.reviews.service";
import { sendResponse } from "../../utils/response.util";

export const getReviews = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.UNAUTHORIZED,
            message: "User not authenticated",
            data: null,
        });
    }
    
    const data = await VendorReviewsService.getProviderReviews(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Reviews retrieved successfully",
        data,
    });
};

export const getReviewStats = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.UNAUTHORIZED,
            message: "User not authenticated",
            data: null,
        });
    }
    
    const data = await VendorReviewsService.getProviderReviewStats(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Review stats retrieved successfully",
        data,
    });
};

export const getReviewById = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const reviewId = req.params.id;
    
    if (!userId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.UNAUTHORIZED,
            message: "User not authenticated",
            data: null,
        });
    }
    
    if (!reviewId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.BAD_REQUEST,
            message: "Review ID is required",
            data: null,
        });
    }
    
    const data = await VendorReviewsService.getReviewById(reviewId, userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Review retrieved successfully",
        data,
    });
};
