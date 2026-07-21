import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerServicesService } from "../../services/customer/customer.services.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getServices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerServicesService.getServices(req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_SERVICES_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getRecommendedServices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerServicesService.getRecommendedServices(req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_RECOMMENDED_SERVICES_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getServiceByPublicId = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const publicId = String(req.params.publicId ?? "");
    const data = await CustomerServicesService.getServiceByPublicId(publicId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_SERVICE_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};
