import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminNotesService } from "../../services/admin/admin.notes.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";

export const listNotes = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const relatedModule = String(req.query.relatedModule || "");
    const relatedRecordId = String(req.query.relatedRecordId || "");
    const data = await AdminNotesService.list(relatedModule, relatedRecordId, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: t("ADMIN_NOTES_RETRIEVED", lang),
        data,
    });
};

export const createNote = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const adminUserId = (req as any).user.userId;
    const data = await AdminNotesService.create(adminUserId, req.body, lang);
    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: t("ADMIN_NOTE_CREATED", lang),
        data,
    });
};
