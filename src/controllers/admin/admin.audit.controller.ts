import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminAuditService } from "../../services/admin/admin.audit.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listAuditLogs = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminAuditService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Audit logs retrieved", data });
};
