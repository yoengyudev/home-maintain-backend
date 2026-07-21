import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { CustomerFaqsService } from "../../services/customer/customer.faqs.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listFaqs = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await CustomerFaqsService.listFaqs(req.query, lang);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("CUSTOMER_FAQS_FETCHED_SUCCESSFULLY", lang),
        data,
    });
};
