import { NextFunction, Request, Response } from "express";
import { getLang } from "../utils/get-lang.util";
import { getVerifiedAccessTokenPayload } from "../utils/auth-token.util";
import { UnauthorizedException } from "../utils/app-error.util";
import { assertActiveCustomerSession, assertActiveProviderSession } from "../helper/customer/auth.helper";
import { UserRole } from "../generated/prisma/enums";
import { t } from "../i18n/translate";

export const authenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const lang = getLang(req);
    try {
        const decoded = getVerifiedAccessTokenPayload(req, lang, {
            requireTokenVersion: false,
        });

        // Customer tokens include sid; revoked sessions must be rejected after logout.
        if (decoded.role === UserRole.CUSTOMER) {
            await assertActiveCustomerSession(decoded.userId, decoded.sid, lang);
        }

        if (decoded.role === UserRole.PROVIDER) {
            await assertActiveProviderSession(decoded.userId, decoded.sid, lang);
        }

        (req as any).user = decoded;
        next();
    } catch (error: unknown) {
        if (error instanceof UnauthorizedException) {
            return next(error);
        }
        return next(new UnauthorizedException(t("ERROR_INVALID_TOKEN", lang)));
    }
};
