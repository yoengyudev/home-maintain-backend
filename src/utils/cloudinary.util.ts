import { v2 as cloudinary } from "cloudinary";

const trim = (value: string | undefined) => (value ?? "").trim();

if (process.env.CLOUDINARY_URL?.trim()) {
    cloudinary.config(process.env.CLOUDINARY_URL.trim());
} else {
    const cloud_name = trim(process.env.CLOUDINARY_CLOUD_NAME);
    const api_key = trim(process.env.CLOUDINARY_API_KEY);
    const api_secret = trim(process.env.CLOUDINARY_API_SECRET);

    console.log("cloud_name", cloud_name);
    console.log("api_key", api_key);
    console.log("api_secret", api_secret);

    if (!cloud_name || !api_key || !api_secret) {
        throw new Error(
            "Cloudinary: set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
        );
    }

    cloudinary.config({
        cloud_name,
        api_key,
        api_secret,
    });
}

export default cloudinary;

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
        const expectedCloud = cloudinary.config().cloud_name;
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
