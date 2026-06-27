import type { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { t } from "../../i18n/translate";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import {
    getSampleByIdPublicService,
    getSamplesPublicService,
} from "../../services/sample/sample-public.service";
import { getLang } from "../../utils/get-lang.util";
import { sendResponse } from "../../utils/response.util";

/**
 * Returns paginated sample list for public endpoints.
 *
 * No token validation is required.
 * Supports pagination and optional search via query params.
 */
export const getSamplesPublicController = asyncHandler(async (req: Request, res: Response) => {
    const lang = getLang(req);
    const result = await getSamplesPublicService(req);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SAMPLES_FETCHED_SUCCESSFULLY", lang),
        data: result,
    });
});

/**
 * Returns one active sample by id for public endpoints.
 *
 * No token validation is required.
 * `id` is read from route params.
 */
export const getSampleByIdPublicController = asyncHandler(
    async (req: Request, res: Response) => {
        const lang = getLang(req);
        const sample = await getSampleByIdPublicService(req);

        return sendResponse(res, {
            statusCode: HTTPSTATUS.OK,
            message: t("SAMPLE_FETCHED_SUCCESSFULLY", lang),
            data: sample,
        });
    }
);
