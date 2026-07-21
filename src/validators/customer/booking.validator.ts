import { z } from "zod";
import { customerAddressBodySchema } from "./address.validator";

export const customerCreateBookingSchema = z
    .object({
        /** Preferred: internal service listing id */
        serviceId: z.string().trim().min(1).optional(),
        /** @deprecated use serviceId — still accepted for older clients */
        servicePublicId: z.string().trim().min(1).optional(),
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
    .refine((data) => Boolean(data.serviceId) || Boolean(data.servicePublicId), {
        message: "serviceId is required",
        path: ["serviceId"],
    })
    .refine((data) => Boolean(data.addressId) || Boolean(data.address), {
        message: "addressId or address is required",
        path: ["addressId"],
    })
    .transform((data) => ({
        ...data,
        serviceId: (data.serviceId ?? data.servicePublicId) as string,
    }));

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
