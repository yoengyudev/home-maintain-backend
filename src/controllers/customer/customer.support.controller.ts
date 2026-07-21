import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerSupportService } from "../../services/customer/customer.support.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getAboutPage = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerSupportService.getAbout(lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_SUPPORT_ABOUT_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getMissionPage = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerSupportService.getMission(lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_SUPPORT_MISSION_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};
