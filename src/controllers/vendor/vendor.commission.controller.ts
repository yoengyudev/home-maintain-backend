import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorCommissionService } from "../../services/vendor/vendor.commission.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const getCommissionSummary = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorCommissionService.getSummary(userId, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_COMMISSION_SUMMARY_RETRIEVED", lang),
        data,
    });
};

export const listInvoices = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const data = await VendorCommissionService.listInvoices(userId, req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_COMMISSION_INVOICES_RETRIEVED", lang),
        data,
    });
};

export const getInvoiceById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorCommissionService.getInvoiceById(userId, id, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("VENDOR_COMMISSION_INVOICE_RETRIEVED", lang),
        data,
    });
};

export const submitPaymentProof = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const userId = (req as any).user?.userId;
    const id = String(req.params.id ?? "");
    const data = await VendorCommissionService.submitPaymentProof(userId, id, req.body, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: lang === "kh" ? "ភស្តុតាងទូទាត់ត្រូវបានបញ្ជូនដោយជោគជ័យ" : "Payment proof submitted successfully",
        data,
    });
};

