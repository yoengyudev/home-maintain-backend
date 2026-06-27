import type { Request } from "express";
import type { UserRole } from "../generated/prisma/enums";
import { Lang, MessageKey } from "../i18n/messages";
import { t } from "../i18n/translate";
import { ForbiddenException, UnauthorizedException } from "./app-error.util";
import { verifyAccessToken } from "./jwt.util";


export type AccessTokenPayload = {
    userId: string;
    role: UserRole;
    tokenVersion?: number;
};

type AccessTokenOptions = {
    expectedRole?: UserRole;
    forbiddenMessageKey?: MessageKey;
    requireTokenVersion?: boolean;
};

export const assertRole = (
    actualRole: unknown,
    expectedRole: UserRole,
    lang: Lang,
    forbiddenMessageKey: MessageKey = "UNAUTHORIZED"
) => {
    if (actualRole !== expectedRole) {
        throw new ForbiddenException(t(forbiddenMessageKey, lang));
    }
};

export const getVerifiedAccessTokenPayload = (
    req: Request,
    lang: Lang,
    options: AccessTokenOptions = {}
): AccessTokenPayload => {
    const authorization = req.headers.authorization;
    const authHeader = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) {
        throw new UnauthorizedException(t("UNAUTHORIZED", lang));
    }

    const decoded = verifyAccessToken(token) as AccessTokenPayload | null;
    if (!decoded?.userId) {
        throw new UnauthorizedException(t("UNAUTHORIZED", lang));
    }

    if (options.expectedRole) {
        assertRole(
            decoded.role,
            options.expectedRole,
            lang,
            options.forbiddenMessageKey ?? "UNAUTHORIZED"
        );
    }

    const shouldRequireTokenVersion = options.requireTokenVersion ?? true;
    if (shouldRequireTokenVersion && typeof decoded.tokenVersion !== "number") {
        throw new UnauthorizedException(t("UNAUTHORIZED", lang));
    }

    return decoded;
};
