import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorServiceService } from "../../services/vendor/vendor.service.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getServices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorServiceService.getServices(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_SERVICES_RETRIEVED", lang),
        data,
    });
};

export const getServiceById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const data = await VendorServiceService.getServiceById(userId, serviceId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_SERVICE_RETRIEVED", lang),
        data,
    });
};

export const createService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorServiceService.createService(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("VENDOR_SERVICE_CREATED", lang),
        data,
    });
};

export const updateService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const data = await VendorServiceService.updateService(userId, serviceId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_SERVICE_UPDATED", lang),
        data,
    });
};

export const deleteService = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const data = await VendorServiceService.deleteService(userId, serviceId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_SERVICE_DELETED", lang),
        data,
    });
};

export const toggleServiceStatus = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const { active } = req.body;
    const data = await VendorServiceService.toggleServiceStatus(userId, serviceId, active, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_SERVICE_STATUS_UPDATED", lang),
        data,
    });
};

export const getServiceCategories = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorServiceService.getServiceCategories();

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_CATEGORIES_RETRIEVED", lang),
        data,
    });
};

export const getServiceAreas = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorServiceService.getServiceAreas();

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_SERVICE_AREAS_RETRIEVED", lang),
        data,
    });
};
