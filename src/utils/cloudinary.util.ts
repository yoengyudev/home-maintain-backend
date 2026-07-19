import { v2 as cloudinary } from "cloudinary";

const trim = (value: string | undefined) => (value ?? "").trim();

export const CUSTOMER_PROFILE_IMAGE_FOLDER = "home-maintain/customer/profile";

const cloudinaryUrl = trim(process.env.CLOUDINARY_URL);
const cloud_name = trim(process.env.CLOUDINARY_CLOUD_NAME);
const api_key = trim(process.env.CLOUDINARY_API_KEY);
const api_secret = trim(process.env.CLOUDINARY_API_SECRET);

const hasExplicitCredentials = Boolean(cloud_name && api_key && api_secret);
const isConfigured = Boolean(hasExplicitCredentials || cloudinaryUrl);

/**
 * Cloudinary's first `config()` call also reads `process.env.CLOUDINARY_URL`.
 * Prefer explicit CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET and clear any stale URL.
 */
if (hasExplicitCredentials) {
    delete process.env.CLOUDINARY_URL;
    cloudinary.config(true);
    cloudinary.config({
        cloud_name,
        api_key,
        api_secret,
        secure: true,
    });
    console.info(`[cloudinary] configured cloud_name=${cloud_name}`);
} else if (cloudinaryUrl) {
    process.env.CLOUDINARY_URL = cloudinaryUrl;
    cloudinary.config(true);
    console.info(`[cloudinary] configured from CLOUDINARY_URL cloud_name=${cloudinary.config().cloud_name}`);
} else {
    console.warn(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or CLOUDINARY_URL)."
    );
}

export default cloudinary;

export const isCloudinaryConfigured = () => isConfigured;

export const getCloudinaryCloudName = () =>
    trim(cloudinary.config().cloud_name as string | undefined) || cloud_name || null;

const assertCloudinaryConfigured = () => {
    if (!isConfigured) {
        throw new Error(
            "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or CLOUDINARY_URL)."
        );
    }
};

/**
 * Uploads image bytes to Cloudinary and returns the secure URL.
 */
export const uploadImageBuffer = (
    fileBuffer: Buffer,
    folder: string
): Promise<{ secure_url: string }> => {
    assertCloudinaryConfigured();

    const activeCloudName = getCloudinaryCloudName();
    if (!activeCloudName) {
        throw new Error("Cloudinary cloud_name is missing");
    }

    return new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
            {
                folder,
                // Ensure upload targets the configured cloud, not a stale URL cloud.
            },
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
};

/**
 * Parses a Cloudinary delivery URL and returns the `public_id` for API calls (e.g. destroy).
 * Skips version segments (`v123…`) and transformation segments (contain `,`).
 */
export function extractPublicIdFromCloudinaryUrl(
    imageUrl: string | null | undefined
): string | null {
    if (!imageUrl?.trim()) {
        return null;
    }
    try {
        const u = new URL(imageUrl.trim());
        if (u.hostname !== "res.cloudinary.com") {
            return null;
        }
        const expectedCloud = getCloudinaryCloudName();
        const segments = u.pathname.split("/").filter(Boolean);
        // /{cloud_name}/image/upload/...
        if (segments.length < 4) {
            return null;
        }
        const [cloud, resourceType, uploadLiteral] = segments;
        if (
            uploadLiteral !== "upload" ||
            resourceType !== "image" ||
            (expectedCloud && cloud !== expectedCloud)
        ) {
            return null;
        }
        const afterUpload = segments.slice(3);
        const pathParts: string[] = [];
        for (const seg of afterUpload) {
            if (/^v\d+$/i.test(seg)) {
                continue;
            }
            if (seg.includes(",")) {
                continue;
            }
            pathParts.push(seg);
        }
        if (!pathParts.length) {
            return null;
        }
        const last = pathParts.pop();
        if (!last) {
            return null;
        }
        pathParts.push(last.replace(/\.[^/.]+$/, ""));
        return pathParts.join("/") || null;
    } catch {
        return null;
    }
}

/** Best-effort delete of a previous asset; logs and does not throw (DB already points at the new file). */
export function destroyCloudinaryImageByUrl(
    imageUrl: string | null | undefined
): Promise<void> {
    if (!isConfigured) {
        return Promise.resolve();
    }

    const publicId = extractPublicIdFromCloudinaryUrl(imageUrl);
    if (!publicId) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        cloudinary.uploader.destroy(publicId, (err) => {
            if (err) {
                console.warn(
                    `[cloudinary] could not delete asset "${publicId}":`,
                    err instanceof Error ? err.message : err
                );
            }
            resolve();
        });
    });
}
