import { ErrorRequestHandler } from "express";
import { AppError, ErrorCode } from "../utils/app-error.util";
import { HTTPSTATUS } from "../config/http.config";

export const errorHandler: ErrorRequestHandler = (error, req, res, next): any => {
    console.log(`Error occurred: ${req.path}`, error);

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            error: error.errorCode,
        });
    }

    return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal server error",
        error: error?.message || "Something went wrong",
        errorCode: ErrorCode.ERROR_INTERNAL,
    });
}