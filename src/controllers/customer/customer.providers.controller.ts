import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerProvidersService } from "../../services/customer/customer.providers.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getProviders = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerProvidersService.getProviders(req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_PROVIDERS_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getRecommendedProviders = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerProvidersService.getRecommendedProviders(req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_RECOMMENDED_PROVIDERS_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getProviderByPublicId = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const publicId = String(req.params.publicId ?? "");
    const data = await CustomerProvidersService.getProviderByPublicId(publicId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_PROVIDER_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};
