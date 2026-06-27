import { NextFunction } from "express";
import { Request, Response } from "express";
import { getLang } from "../utils/get-lang.util";
import { UnauthorizedException } from "../utils/app-error.util";
import { assertRole } from "../utils/auth-token.util";
import { UserRole } from "../generated/prisma/enums";

export const authorize = (role: UserRole) => {
    return (req: Request, _res: Response, next: NextFunction) => {  
        const user = (req as any).user;
        const lang = getLang(req);

        if (!user) {
            throw new UnauthorizedException("Unauthorized");
        }

        assertRole(user.role, role, lang, "UNAUTHORIZED");
        next();
    }
}