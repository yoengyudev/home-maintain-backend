import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerAddressesService } from "../../services/customer/customer.addresses.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listAddresses = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerAddressesService.list(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_ADDRESSES_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const getAddressById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await CustomerAddressesService.getById(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_ADDRESSES_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};

export const createAddress = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await CustomerAddressesService.create(userId, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("CUSTOMER_ADDRESS_CREATED_SUCCESSFULLY", lang),
        data,
    });
};

export const updateAddress = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await CustomerAddressesService.update(userId, id, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_ADDRESS_UPDATED_SUCCESSFULLY", lang),
        data,
    });
};

export const deleteAddress = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await CustomerAddressesService.remove(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_ADDRESS_DELETED_SUCCESSFULLY", lang),
        data,
    });
};
