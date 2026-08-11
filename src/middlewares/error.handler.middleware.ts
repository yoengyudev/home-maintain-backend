import { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
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

    if (error?.type === "entity.too.large" || error?.status === 413) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
            success: false,
            message: "Request is too large. Upload images separately instead of embedding them.",
            error: ErrorCode.ERROR_BAD_REQUEST,
        });
    }

    if (error instanceof MulterError) {
        const message =
            error.code === "LIMIT_UNEXPECTED_FILE"
                ? `Unexpected file field "${error.field}". Use "avatar" or "avatarUrl"`
                : error.code === "LIMIT_FILE_SIZE"
                  ? "Image file is too large. Max size is 5MB"
                  : error.message;

        return res.status(HTTPSTATUS.BAD_REQUEST).json({
            success: false,
            message,
            error: ErrorCode.ERROR_BAD_REQUEST,
        });
    }

    return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal server error",
        error: error?.message || "Something went wrong",
        errorCode: ErrorCode.ERROR_INTERNAL,
    });
};
