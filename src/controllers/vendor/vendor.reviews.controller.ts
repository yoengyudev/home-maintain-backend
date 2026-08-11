import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorReviewsService } from "../../services/vendor/vendor.reviews.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getReviews = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;

    if (!userId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.UNAUTHORIZED,
            message: t("VENDOR_USER_NOT_AUTHENTICATED", lang),
            data: null,
        });
    }

    const data = await VendorReviewsService.getProviderReviews(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_REVIEWS_RETRIEVED", lang),
        data,
    });
};

export const getReviewStats = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;

    if (!userId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.UNAUTHORIZED,
            message: t("VENDOR_USER_NOT_AUTHENTICATED", lang),
            data: null,
        });
    }

    const data = await VendorReviewsService.getProviderReviewStats(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_REVIEW_STATS_RETRIEVED", lang),
        data,
    });
};

export const getReviewById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const reviewId = String(req.params.id ?? "");

    if (!userId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.UNAUTHORIZED,
            message: t("VENDOR_USER_NOT_AUTHENTICATED", lang),
            data: null,
        });
    }

    if (!reviewId) {
        return sendResponse(res, {
            statusCode: HTTPSTATUS.BAD_REQUEST,
            message: t("VENDOR_REVIEW_ID_REQUIRED", lang),
            data: null,
        });
    }

    const data = await VendorReviewsService.getReviewById(reviewId, userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_REVIEW_RETRIEVED", lang),
        data,
    });
};
