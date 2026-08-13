import jwt, { type SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error("JWT secrets are not configured");
}

const DURATION_TO_MS: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
};

function parseDurationToMs(value: string): number | null {
    const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(value.trim());
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = DURATION_TO_MS[unit];
    if (!Number.isFinite(amount) || amount <= 0 || !multiplier) return null;
    return amount * multiplier;
}

/**
 * Access token TTL.
 * Prefer JWT_ACCESS_EXPIRES_IN; fall back to JWT_EXPIRATION_TIME (legacy); default 7d.
 */
export const getAccessExpiresIn = () =>
    process.env.JWT_ACCESS_EXPIRES_IN ??
    process.env.JWT_EXPIRATION_TIME ??
    "7d";

/**
 * Refresh token / account-session TTL. Must be >= access token lifetime.
 * Default 30d.
 */
export const getRefreshExpiresIn = () =>
    process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";

export const getRefreshTokenExpiresAt = () => {
    const ttlMs = parseDurationToMs(getRefreshExpiresIn());
    if (ttlMs == null) {
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    return new Date(Date.now() + ttlMs);
};

export const signAccessToken = (payload: object) => {
    const options: SignOptions = {
        expiresIn: getAccessExpiresIn() as StringValue,
    };
    return jwt.sign(payload, ACCESS_SECRET, options);
};

export const signRefreshToken = (payload: object) => {
    const options: SignOptions = {
        expiresIn: getRefreshExpiresIn() as StringValue,
    };
    return jwt.sign(payload, REFRESH_SECRET, options);
};

/** Customer tokens do not expire; session is invalidated only on logout (revokedAt). */
export const signCustomerAccessToken = (payload: object) => {
    // Intentionally omit `expiresIn` so JWT has no `exp` claim.
    return jwt.sign(payload, ACCESS_SECRET);
};

export const signCustomerRefreshToken = (payload: object) => {
    // Intentionally omit `expiresIn` so JWT has no `exp` claim.
    return jwt.sign(payload, REFRESH_SECRET);
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
