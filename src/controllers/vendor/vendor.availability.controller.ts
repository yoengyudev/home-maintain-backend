import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorAvailabilityService } from "../../services/vendor/vendor.availability.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getAvailability = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorAvailabilityService.getAvailability(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_AVAILABILITY_RETRIEVED", lang),
        data,
    });
};

export const updateAvailability = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorAvailabilityService.updateAvailability(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_AVAILABILITY_UPDATED", lang),
        data,
    });
};
