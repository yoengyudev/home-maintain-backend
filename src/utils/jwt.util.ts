import jwt, { type SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error("JWT secrets are not configured");
}

/** Access token TTL. Examples: 15m, 1h, 24h (avoid longer than refresh). */
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "1h";

/** Refresh token TTL. Must be >= access token lifetime. Examples: 7d, 30d. */
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

export const signAccessToken = (payload: object) => {
    const options: SignOptions = { expiresIn: ACCESS_EXPIRES_IN as StringValue };
    return jwt.sign(payload, ACCESS_SECRET, options);
};

export const signRefreshToken = (payload: object) => {
    const options: SignOptions = { expiresIn: REFRESH_EXPIRES_IN as StringValue };
    return jwt.sign(payload, REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string) => {
    try {
        return jwt.verify(token, ACCESS_SECRET) as any;
    } catch {
        return null;
    }
};

export const verifyRefreshToken = (token: string) => {
    try {
        return jwt.verify(token, REFRESH_SECRET) as any;
    } catch {
        return null;
    }
};