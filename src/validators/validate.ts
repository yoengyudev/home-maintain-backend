import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { BadRequestException } from "../utils/app-error.util";

export const validate = (schema: ZodSchema) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            throw new BadRequestException(result.error.message);
        }

        req.body = result.data;
        next();
    };
};