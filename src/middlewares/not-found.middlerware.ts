import { NextFunction, Request, Response } from "express";
import { NotFoundException } from "../utils/app-error.util";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundException(`Route ${req.method} ${req.originalUrl} not found`));
};