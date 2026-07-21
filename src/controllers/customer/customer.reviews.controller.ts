import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerReviewsService } from "../../services/customer/customer.reviews.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const createBookingReview = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const publicId = String(req.params.publicId ?? "");
    const data = await CustomerReviewsService.createForBooking(
        userId,
        publicId,
        req.body,
        lang
    );

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("CUSTOMER_REVIEW_CREATED_SUCCESSFULLY", lang),
        data,
    });
};

export const getBookingReview = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const publicId = String(req.params.publicId ?? "");
    const data = await CustomerReviewsService.getForBooking(userId, publicId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_REVIEW_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};
