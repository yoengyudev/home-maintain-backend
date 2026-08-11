import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminHelpService } from "../../services/admin/admin.help.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listFaqs = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminHelpService.listFaqs(req.query as Record<string, unknown>, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_FAQS_RETRIEVED", lang),
        data,
    });
};

export const getFaqById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminHelpService.getFaqById(req.params.id as string, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_FAQ_RETRIEVED", lang),
        data,
    });
};

export const createFaq = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminHelpService.createFaq(req.body, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("ADMIN_FAQ_CREATED", lang),
        data,
    });
};

export const updateFaq = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminHelpService.updateFaq(req.params.id as string, req.body, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_FAQ_UPDATED", lang),
        data,
    });
};

export const disableFaq = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminHelpService.disableFaq(req.params.id as string, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_FAQ_DISABLED", lang),
        data,
    });
};

export const restoreFaq = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminHelpService.restoreFaq(req.params.id as string, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_FAQ_RESTORED", lang),
        data,
    });
};

export const deleteFaq = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminHelpService.deleteFaq(req.params.id as string, adminUserId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_FAQ_DELETED", lang),
        data,
    });
};

export const listSupportPages = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminHelpService.listSupportPages();
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SUPPORT_PAGES_RETRIEVED", lang),
        data,
    });
};

export const getSupportPage = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminHelpService.getSupportPage(req.params.pageKey as string, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SUPPORT_PAGE_RETRIEVED", lang),
        data,
    });
};

export const updateSupportPage = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminHelpService.updateSupportPage(
        req.params.pageKey as string,
        req.body,
        adminUserId,
        lang
    );
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SUPPORT_PAGE_UPDATED", lang),
        data,
    });
};

export const listSupportRequests = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminHelpService.listSupportRequests(req.query as Record<string, unknown>);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SUPPORT_REQUESTS_RETRIEVED", lang),
        data,
    });
};

export const updateSupportRequest = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminHelpService.updateSupportRequest(
        req.params.id as string,
        req.body.status,
        adminUserId,
        lang
    );
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_SUPPORT_REQUEST_UPDATED", lang),
        data,
    });
};
