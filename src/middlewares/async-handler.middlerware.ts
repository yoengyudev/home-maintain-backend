import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.util";
import { HTTPSTATUS } from "../config/http.config";

type AsyncController = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<any>;

export const asyncHandler = (controller: AsyncController) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await controller(req, res, next);
            logger.info(`${req.method} ${req.originalUrl} - ${HTTPSTATUS.OK}`);
        } catch (error) {
            next(error);
        }
    }
}