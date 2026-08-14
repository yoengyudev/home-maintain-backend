import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminCommissionService } from "../../services/admin/admin.commission.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getCommissionSetting = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCommissionService.getSetting(lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_COMMISSION_SETTING_RETRIEVED", lang),
        data,
    });
};

export const updateCommissionSetting = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCommissionService.updateSetting(req.body, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_COMMISSION_SETTING_UPDATED", lang),
        data,
    });
};

export const listCommissions = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCommissionService.listCommissions(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_COMMISSION_RECORDS_RETRIEVED", lang),
        data,
    });
};

export const generateInvoice = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCommissionService.generateInvoice(req.body, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("ADMIN_COMMISSION_INVOICE_GENERATED", lang),
        data,
    });
};

export const listInvoices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCommissionService.listInvoices(req.query, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_COMMISSION_INVOICES_RETRIEVED", lang),
        data,
    });
};

export const getInvoiceById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminCommissionService.getInvoiceById(id, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_COMMISSION_INVOICE_RETRIEVED", lang),
        data,
    });
};

export const markInvoicePaid = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const id = req.params.id as string;
    const data = await AdminCommissionService.markInvoicePaid(id, req.body, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_COMMISSION_INVOICE_MARKED_PAID", lang),
        data,
    });
};
