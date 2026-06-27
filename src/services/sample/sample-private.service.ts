import { UserRole, type Prisma } from "../../generated/prisma/client";
import type { Request } from "express";
import { prisma } from "../../database/prisma.client";
import { t } from "../../i18n/translate";
import { getVerifiedAccessTokenPayload } from "../../utils/auth-token.util";
import { getLang } from "../../utils/get-lang.util";
import { BadRequestException, InternalServerException, NotFoundException } from "../../utils/app-error.util";
import { buildPaginationMeta, parsePaginationQuery } from "../../utils/pagination.util";
import cloudinary, { destroyCloudinaryImageByUrl } from "../../utils/cloudinary.util";

/**
 * Normalizes query values that may come from Express as:
 * - a single string
 * - an array of strings
 * - anything else
 *
 * Returns the first valid string, otherwise `undefined`.
 */
const firstQueryString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }

    return undefined;
};

/**
 * Builds Prisma filter for sample list endpoint.
 * Always excludes soft-deleted rows and optionally applies
 * case-insensitive search on `name` using `search` or `q`.
 */
const buildSampleWhere = (req: Request): Prisma.SampleWhereInput => {
    const where: Prisma.SampleWhereInput = {
        deletedAt: null,
    };

    const searchRaw = firstQueryString(req.query.search) ?? firstQueryString(req.query.q);
    const search = searchRaw?.trim();
    if (search) {
        where.name = { contains: search, mode: "insensitive" };
    }

    return where;
};

/**
 * Reads `req.params.id` and validates it as a non-empty string.
 * Throws localized `BadRequestException` when the id is missing/invalid.
 */
const getSampleIdOrThrow = (req: Request, lang: "en" | "kh") => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
        throw new BadRequestException(t("INVALID_SAMPLE_ID", lang));
    }
    return id;
};

/**
 * Extracts uploaded image file from multiple multer styles:
 * - `req.file` for `upload.single("image")`
 * - `req.files[0]` for array upload
 * - `req.files.image[0]` for named field upload
 */
const getSampleImageFile = (req: Request): Express.Multer.File | undefined => {
    if (req.file) {
        return req.file;
    }

    const files = (req.files ?? {}) as
        | Record<string, Express.Multer.File[] | undefined>
        | Express.Multer.File[];

    if (Array.isArray(files)) {
        return files[0];
    }

    return files.image?.[0];
};

/**
 * Uploads image bytes to Cloudinary and returns uploaded URL.
 * Maps common Cloudinary auth/upload failures to localized internal errors.
 */
const uploadSampleImage = async (fileBuffer: Buffer, lang: "en" | "kh") => {
    try {
        return await new Promise<{ secure_url: string }>((resolve, reject) => {
            const upload = cloudinary.uploader.upload_stream(
                // create folder to store sample images
                { folder: "home-service-booking/sample-images" },
                (error, result) => {
                    if (error || !result?.secure_url) {
                        reject(error ?? new Error("Image upload failed"));
                        return;
                    }
                    resolve({ secure_url: result.secure_url });
                }
            );
            upload.end(fileBuffer);
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const maybeObj = err as { message?: string; http_code?: number } | null;

        if (message.includes("Invalid Signature") || maybeObj?.http_code === 401) {
            throw new InternalServerException(t("CLOUDINARY_INVALID_CREDENTIALS", lang));
        }

        throw new InternalServerException(t("IMAGE_UPLOAD_FAILED", lang));
    }
};

/**
 * Returns paginated sample list (admin-only).
 * Response shape: `{ data, meta }`.
 */
export const getSamplesService = async (req: Request) => {
    // get language from request
    const lang = getLang(req);
    // validate user must be logged yet and have role admin(can validate with customer and vendor role), if public function not need to validate role and token, can remove
    getVerifiedAccessTokenPayload(req, lang, {
        expectedRole: UserRole.ADMIN,
        forbiddenMessageKey: "UNAUTHORIZED",
    });

    // parse pagination query
    const { page, limit, skip, take } = parsePaginationQuery(req.query.page, req.query.limit);
    // build sample where
    const where = buildSampleWhere(req);
    // get samples

    const [samples, total] = await Promise.all([
        prisma.sample.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
        }),
        prisma.sample.count({ where }),
    ]);

    return {
        // return samples
        data: samples,
        // return pagination meta
        meta: buildPaginationMeta(page, limit, total),
    };
};

/**
 * Returns one active sample by id (admin-only).
 * Throws `NotFoundException` when record does not exist or is soft-deleted.
 */
export const getSampleByIdService = async (req: Request) => {
    // get language from request
    const lang = getLang(req);
    // validate user must be logged yet and have role admin(can validate with customer and vendor role), if public function not need to validate role and token, can remove
    getVerifiedAccessTokenPayload(req, lang, {
        expectedRole: UserRole.ADMIN,
        forbiddenMessageKey: "UNAUTHORIZED",
    });

    // get sample id
    const id = getSampleIdOrThrow(req, lang);
    // get sample
    const sample = await prisma.sample.findFirst({
        where: {
            id,
            deletedAt: null,
        },
    });

    // if sample not found, throw not found exception
    if (!sample) {
        throw new NotFoundException(t("SAMPLE_NOT_FOUND", lang));
    }

    // return sample
    return sample;
};

/**
 * Creates a sample (admin-only).
 * - Requires `name`
 * - Resolves image from uploaded file first, then falls back to body.image URL
 * - Persists final image URL to Neon via Prisma
 */
export const createSampleService = async (req: Request) => {
    // get language from request
    const lang = getLang(req);
    // validate user must be logged yet and have role admin(can validate with customer and vendor role), if public function not need to validate role and token, can remove
    getVerifiedAccessTokenPayload(req, lang, {
        expectedRole: UserRole.ADMIN,
        forbiddenMessageKey: "UNAUTHORIZED",
    });

    const body = (req.body ?? {}) as {
        name?: unknown;
        image?: unknown; // optional fallback URL when file is not uploaded
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const imageFromBody = typeof body.image === "string" ? body.image.trim() : "";
    const imageFile = getSampleImageFile(req);

    if (!name) {
        throw new BadRequestException(t("SAMPLE_NAME_REQUIRED", lang));
    }

    let image = imageFromBody;
    if (imageFile?.buffer?.length) {
        const uploaded = await uploadSampleImage(imageFile.buffer, lang);
        image = uploaded.secure_url;
    }
    if (!image) {
        throw new BadRequestException(t("SAMPLE_IMAGE_REQUIRED", lang));
    }

    return prisma.sample.create({
        data: {
            name,
            image,
        },
    });
};

/**
 * Updates an active sample (admin-only).
 * - Supports partial updates for `name` and `image`
 * - If a new file is uploaded, it uploads to Cloudinary and replaces `image`
 * - Deletes previous Cloudinary image after successful DB update
 */
export const updateSampleService = async (req: Request) => {
    // get language from request
    const lang = getLang(req);
    // validate user must be logged yet and have role admin(can validate with customer and vendor role), if public function not need to validate role and token, can remove
    getVerifiedAccessTokenPayload(req, lang, {
        expectedRole: UserRole.ADMIN,
        forbiddenMessageKey: "UNAUTHORIZED",
    });

    const id = getSampleIdOrThrow(req, lang);
    const existing = await prisma.sample.findFirst({
        where: {
            id,
            deletedAt: null,
        },
    });
    if (!existing) {
        throw new NotFoundException(t("SAMPLE_NOT_FOUND", lang));
    }

    const body = (req.body ?? {}) as {
        name?: unknown;
        image?: unknown; // optional fallback URL when file is not uploaded
    };
    const imageFile = getSampleImageFile(req);

    const data: Prisma.SampleUpdateInput = {};
    if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) {
            throw new BadRequestException(t("SAMPLE_NAME_CANNOT_BE_EMPTY", lang));
        }
        data.name = name;
    }

    if (body.image !== undefined) {
        const image = String(body.image).trim();
        if (!image) {
            throw new BadRequestException(t("SAMPLE_IMAGE_CANNOT_BE_EMPTY", lang));
        }
        data.image = image;
    }

    let uploadedImageUrl: string | null = null;
    if (imageFile?.buffer?.length) {
        const uploaded = await uploadSampleImage(imageFile.buffer, lang);
        uploadedImageUrl = uploaded.secure_url;
        data.image = uploadedImageUrl;
    }

    if (!Object.keys(data).length) {
        throw new BadRequestException(t("SAMPLE_NO_UPDATABLE_FIELDS", lang));
    }

    const updated = await prisma.sample.update({
        where: { id },
        data,
    });

    if (uploadedImageUrl && existing.image) {
        await destroyCloudinaryImageByUrl(existing.image);
    }

    return updated;
};

/**
 * Soft-deletes a sample (admin-only).
 * - Sets `deletedAt` and `deletedBy` in Neon via Prisma
 * - Best-effort deletes previous Cloudinary image
 */
export const deleteSampleService = async (req: Request) => {
    // get language from request
    const lang = getLang(req);
    // validate user must be logged yet and have role admin(can validate with customer and vendor role), if public function not need to validate role and token, can remove
    const payload = getVerifiedAccessTokenPayload(req, lang, {
        expectedRole: UserRole.ADMIN,
        forbiddenMessageKey: "UNAUTHORIZED",
    });

    const id = getSampleIdOrThrow(req, lang);
    const existing = await prisma.sample.findFirst({
        where: {
            id,
            deletedAt: null,
        },
    });
    if (!existing) {
        throw new NotFoundException(t("SAMPLE_NOT_FOUND", lang));
    }

    const deleted = await prisma.sample.update({
        where: { id },
        data: {
            deletedAt: new Date(),
            deletedBy: payload.userId,
        },
    });

    if (existing.image) {
        await destroyCloudinaryImageByUrl(existing.image);
    }

    return deleted;
};
