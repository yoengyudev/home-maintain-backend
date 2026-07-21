import { z } from "zod";
import { customerAddressBodySchema } from "./address.validator";

export const customerCreateBookingSchema = z
    .object({
        servicePublicId: z.string().trim().min(1),
        quantity: z.coerce.number().int().min(1).max(20).default(1),
        scheduledDate: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledDate must be YYYY-MM-DD"),
        timeSlot: z.string().trim().min(1).max(80),
        addressId: z.string().trim().min(1).optional(),
        address: customerAddressBodySchema.optional(),
        customerNotes: z.string().trim().max(1000).optional().nullable(),
        accessInstructions: z.string().trim().max(500).optional().nullable(),
    })
    .refine((data) => Boolean(data.addressId) || Boolean(data.address), {
        message: "addressId or address is required",
        path: ["addressId"],
    });

export const customerCancelBookingSchema = z.object({
    reason: z.string().trim().max(500).optional().nullable(),
});

export const customerRescheduleBookingSchema = z.object({
    scheduledDate: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledDate must be YYYY-MM-DD"),
    timeSlot: z.string().trim().min(1).max(80),
});
