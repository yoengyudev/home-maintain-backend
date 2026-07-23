import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { AdminCustomersService } from "../../services/admin/admin.customers.service";
import { sendResponse } from "../../utils/response.util";
import { getLang } from "../../utils/get-lang.util";

export const listCustomers = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await AdminCustomersService.list(req.query, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Customers retrieved", data });
};

export const getCustomerById = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const data = await AdminCustomersService.getById(id, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Customer retrieved", data });
};

export const suspendCustomer = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCustomersService.suspend(id, reason, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Customer suspended", data });
};

export const restoreCustomer = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const { id } = req.params;
    const adminUserId = (req as any).user.userId;
    const data = await AdminCustomersService.restore(id, adminUserId, lang);
    return sendResponse(res, { statusCode: HTTPSTATUS.OK, message: "Customer restored", data });
};
