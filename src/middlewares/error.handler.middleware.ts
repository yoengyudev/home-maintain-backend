import { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { AppError, ErrorCode } from "../utils/app-error.util";
import { HTTPSTATUS } from "../config/http.config";
import { getLang } from "../utils/get-lang.util";
import { t } from "../i18n/translate";

export const errorHandler: ErrorRequestHandler = (error, req, res, next): any => {
    console.log(`Error occurred: ${req.path}`, error);
    const lang = getLang(req);

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
            message: t("ERROR_PAYLOAD_TOO_LARGE", lang),
            error: ErrorCode.ERROR_BAD_REQUEST,
        });
    }

    if (error instanceof MulterError) {
        const message =
            error.code === "LIMIT_UNEXPECTED_FILE"
                ? t("ERROR_UNEXPECTED_FILE_FIELD", lang, { field: error.field ?? "" })
                : error.code === "LIMIT_FILE_SIZE"
                  ? t("ERROR_FILE_TOO_LARGE", lang)
                  : error.message;

        return res.status(HTTPSTATUS.BAD_REQUEST).json({
            success: false,
            message,
            error: ErrorCode.ERROR_BAD_REQUEST,
        });
    }

    return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: t("ERROR_INTERNAL", lang),
        error: error?.message || t("ERROR_INTERNAL", lang),
        errorCode: ErrorCode.ERROR_INTERNAL,
    });
};
