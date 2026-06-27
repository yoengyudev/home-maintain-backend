import { HTTPSTATUS, HttpStatusCode } from "../config/http.config";
import { t } from "../i18n/translate";


export const ErrorCode = {
    ERROR_INTERNAL: "ERROR_INTERNAL",
    ERROR_BAD_REQUEST: "ERROR_BAD_REQUEST",
    ERROR_UNAUTHORIZED: "ERROR_UNAUTHORIZED",
    ERROR_FORBIDDEN: "ERROR_FORBIDDEN",
    ERROR_NOT_FOUND: "ERROR_NOT_FOUND",
    ERROR_METHOD_NOT_ALLOWED: "ERROR_METHOD_NOT_ALLOWED",
    ERROR_CONFLICT: "ERROR_CONFLICT",
    ERROR_UNPROCESSABLE_ENTITY: "ERROR_UNPROCESSABLE_ENTITY",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
    constructor(
        message: string,
        public statusCode: HttpStatusCode = HTTPSTATUS.INTERNAL_SERVER_ERROR,
        public errorCode: ErrorCode = ErrorCode.ERROR_INTERNAL,
    ) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
    }
}

export class InternalServerException extends AppError {
    constructor(message: string = t("ERROR_INTERNAL")) {
        super(message, HTTPSTATUS.INTERNAL_SERVER_ERROR, ErrorCode.ERROR_INTERNAL);
    }
}

export class BadRequestException extends AppError {
    constructor(message: string = t("ERROR_BAD_REQUEST")) {
        super(message, HTTPSTATUS.BAD_REQUEST, ErrorCode.ERROR_BAD_REQUEST);
    }
}

export class UnauthorizedException extends AppError {
    constructor(message: string = t("ERROR_UNAUTHORIZED")) {
        super(message, HTTPSTATUS.UNAUTHORIZED, ErrorCode.ERROR_UNAUTHORIZED);
    }
}

export class ForbiddenException extends AppError {
    constructor(message: string = t("ERROR_FORBIDDEN")) {
        super(message, HTTPSTATUS.FORBIDDEN, ErrorCode.ERROR_FORBIDDEN);
    }
}

export class NotFoundException extends AppError {
    constructor(message: string = t("ERROR_NOT_FOUND")) {
        super(message, HTTPSTATUS.NOT_FOUND, ErrorCode.ERROR_NOT_FOUND);
    }
}