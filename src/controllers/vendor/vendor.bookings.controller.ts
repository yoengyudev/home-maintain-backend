import { Request, Response } from "express";
import { HTTPSTATUS } from "../../config/http.config";
import { VendorVerificationService } from "../../services/vendor/vendor.Verification.service";
import { sendResponse } from "../../utils/response.util";

export const getDraft = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.getDraftVerification(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Draft verification retrieved successfully",
        data,
    });
};

export const saveDraft = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.saveDraftVerification(userId, req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Draft saved successfully",
        data,
    });
};

export const submit = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.submitVerification(userId, req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.CREATED,
        message: "Verification submitted successfully",
        data,
    });
};

export const getStatus = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.getVerificationStatus(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Verification status retrieved successfully",
        data,
    });
};

export const updateForChanges = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.updateVerificationForChanges(userId, req.body);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Verification updated successfully",
        data,
    });
};

export const deleteDraft = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const data = await VendorVerificationService.deleteDraftVerification(userId);

    return sendResponse(res, {
        statusCode: HTTPSTATUS.OK,
        message: "Draft deleted successfully",
        data,
    });
};
