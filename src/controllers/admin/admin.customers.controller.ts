import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminCustomersService } from "../../services/admin/admin.customers.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listCustomers = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCustomersService.list(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CUSTOMERS_RETRIEVED", lang),
        data,
    });
};

export const getCustomerById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminCustomersService.getById(id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CUSTOMER_RETRIEVED", lang),
        data,
    });
};

export const suspendCustomer = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCustomersService.suspend(id, reason, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CUSTOMER_SUSPENDED", lang),
        data,
    });
};

export const restoreCustomer = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCustomersService.restore(id, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_CUSTOMER_RESTORED", lang),
        data,
    });
};
