import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorServiceService } from "../../services/vendor/vendor.services.service";
import { sendResponse } from "../../utils/response.util";

export const getServices = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorServiceService.getServices(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Services retrieved successfully",
        data,
    });
};

export const getServiceById = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const data = await VendorServiceService.getServiceById(userId, serviceId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service retrieved successfully",
        data,
    });
};

export const createService = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorServiceService.createService(userId, req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: "Service created successfully",
        data,
    });
};

export const updateService = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const data = await VendorServiceService.updateService(userId, serviceId, req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service updated successfully",
        data,
    });
};

export const deleteService = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const data = await VendorServiceService.deleteService(userId, serviceId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service deleted successfully",
        data,
    });
};

export const toggleServiceStatus = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const serviceId = Array.isArray(id) ? id[0] : id;
    const { active } = req.body;
    const data = await VendorServiceService.toggleServiceStatus(userId, serviceId, active);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service status updated successfully",
        data,
    });
};

export const getServiceCategories = async (req: Request, res: Response) => {
    const data = await VendorServiceService.getServiceCategories();

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service categories retrieved successfully",
        data,
    });
};

export const getServiceAreas = async (req: Request, res: Response) => {
    const data = await VendorServiceService.getServiceAreas();

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Service areas retrieved successfully",
        data,
    });
};
