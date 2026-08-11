import { NextFunction, Request, Response } from "express";
import { NotFoundException } from "../utils/app-error.util";
import { getLang } from "../utils/get-lang.util";
import { t } from "../i18n/translate";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
    const lang = getLang(req);
    next(new NotFoundException(t("ERROR_ROUTE_NOT_FOUND", lang, {
        method: req.method,
        path: req.originalUrl,
    })));
};