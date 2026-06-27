import { NextFunction, Request, Response } from "express";
import { getLang } from "../utils/get-lang.util";
import { getVerifiedAccessTokenPayload } from "../utils/auth-token.util";
import { UnauthorizedException } from "../utils/app-error.util";

export const authenticate = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        const lang = getLang(req);
        const decoded = getVerifiedAccessTokenPayload(req, lang, {
            requireTokenVersion: false,
        });
        (req as any).user = decoded;
        next();
    } catch (error: unknown) {
        if (error instanceof UnauthorizedException) {
            throw error;
        }
        throw new UnauthorizedException("Invalid token");
    }
};