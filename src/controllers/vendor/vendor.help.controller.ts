import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorHelpService } from "../../services/vendor/vendor.help.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getHelp = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorHelpService.getHelp(lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_HELP_RETRIEVED", lang),
        data,
    });
};

export const submitSupportRequest = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorHelpService.submitRequest(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("VENDOR_SUPPORT_REQUEST_SUBMITTED", lang),
        data,
    });
};
