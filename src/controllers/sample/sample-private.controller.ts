import type { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { t } from "../../i18n/translate";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import {
    createSampleService,
    deleteSampleService,
    getSampleByIdService,
    getSamplesService,
    updateSampleService,
} from "../../services/sample/sample-private.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

/**
 * Returns paginated sample list for private endpoints.
 *
 * Flow:
 * 1) Delegates filtering/pagination/auth logic to `getSamplesService`.
 * 2) Sends normalized API response payload.
 *
 * Response data shape:
 * - `{ data: Sample[], meta: { page, limit, total, totalPages } }`
 */
export const getSamplesController = asyncHandler(async (req: Request, res: Response) => {
    const lang = getLang(req);
    const result = await getSamplesService(req);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SAMPLES_FETCHED_SUCCESSFULLY", lang),
        data: result,
    });
});

/**
 * Returns one sample by id for private endpoints.
 *
 * Notes:
 * - `id` comes from route params (e.g. `/samples/:id`).
 * - Validation and not-found handling are done in service layer.
 */
export const getSampleByIdController = asyncHandler(async (req: Request, res: Response) => {
    const lang = getLang(req);
    const sample = await getSampleByIdService(req);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SAMPLE_FETCHED_SUCCESSFULLY", lang),
        data: sample,
    });
});

/**
 * Creates a new sample record.
 *
 * Expected request content:
 * - `name` (required)
 * - `image` file upload OR `image` URL in body
 *
 * The service handles:
 * - auth/role checks
 * - validation
 * - Cloudinary upload
 * - Neon persistence via Prisma
 */
export const createSampleController = asyncHandler(async (req: Request, res: Response) => {
    const lang = getLang(req);
    const sample = await createSampleService(req);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("SAMPLE_CREATED_SUCCESSFULLY", lang),
        data: sample,
    });
});

/**
 * Updates an existing sample by id.
 *
 * Supports partial updates:
 * - `name`
 * - `image` (file upload or URL)
 *
 * Service layer is responsible for:
 * - ensuring target sample exists
 * - replacing old Cloudinary image when a new file is uploaded
 */
export const updateSampleController = asyncHandler(async (req: Request, res: Response) => {
    const lang = getLang(req);
    const sample = await updateSampleService(req);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SAMPLE_UPDATED_SUCCESSFULLY", lang),
        data: sample,
    });
});

/**
 * Soft-deletes a sample by id.
 *
 * Behavior:
 * - Marks `deletedAt`/`deletedBy` in database (no hard delete).
 * - Attempts to remove related image asset from Cloudinary.
 */
export const deleteSampleController = asyncHandler(async (req: Request, res: Response) => {
    const lang = getLang(req);
    const sample = await deleteSampleService(req);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("SAMPLE_DELETED_SUCCESSFULLY", lang),
        data: sample,
    });
});
