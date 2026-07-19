import { NextFunction, Request, Response } from "express";
import { getLang } from "../utils/get-lang.util";
import { getVerifiedAccessTokenPayload } from "../utils/auth-token.util";
import { UnauthorizedException } from "../utils/app-error.util";
import { assertActiveCustomerSession } from "../helper/customer/auth.helper";
import { UserRole } from "../generated/prisma/enums";

export const authenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        const lang = getLang(req);
        const decoded = getVerifiedAccessTokenPayload(req, lang, {
            requireTokenVersion: false,
        });

        // Customer tokens include sid; revoked sessions must be rejected after logout.
        if (decoded.role === UserRole.CUSTOMER) {
            await assertActiveCustomerSession(decoded.userId, decoded.sid, lang);
        }

        (req as any).user = decoded;
        next();
    } catch (error: unknown) {
        if (error instanceof UnauthorizedException) {
            return next(error);
        }
        return next(new UnauthorizedException("Invalid token"));
    }
};
