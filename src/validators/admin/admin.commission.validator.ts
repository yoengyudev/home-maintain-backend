import { z } from "zod";

export const updateCommissionSettingSchema = z.object({
    type: z.enum(["PERCENTAGE", "FIXED"]),
    value: z.coerce.number().min(0),
    description: z.string().trim().max(255).optional().nullable(),
});

export const generateInvoiceSchema = z.object({
    providerProfileId: z.string().trim().optional().nullable(),
    commissionIds: z.array(z.string().trim().min(1)).min(1),
    dueAt: z.string().optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
});

export const markInvoicePaidSchema = z.object({
    paymentReference: z.string().trim().max(200).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    paidAt: z.string().optional().nullable(),
});
