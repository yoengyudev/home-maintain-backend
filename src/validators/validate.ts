import { NextFunction, Request, Response } from "express";
import { ZodSchema, ZodError } from "zod";
import { BadRequestException } from "../utils/app-error.util";

const formatZodErrors = (error: ZodError): string => {
    return error.issues
        .map((issue) => {
            const field = issue.path.length > 0 ? issue.path.join(".") : "body";
            return `${field}: ${issue.message}`;
        })
        .join("; ");
};

export const validate = (schema: ZodSchema) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            throw new BadRequestException(formatZodErrors(result.error));
        }

        req.body = result.data;
        next();
    };
};
