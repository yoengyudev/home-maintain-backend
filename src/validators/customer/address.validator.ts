import { z } from "zod";

export const customerAddressBodySchema = z.object({
    label: z.string().trim().min(1).max(80),
    fullName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(6).max(30),
    addressLine: z.string().trim().min(3).max(500),
    notes: z.string().trim().max(500).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    detectedLocation: z.string().trim().max(255).optional().nullable(),
    isDefault: z.boolean().optional(),
});

export const customerCreateAddressSchema = customerAddressBodySchema;

export const customerUpdateAddressSchema = customerAddressBodySchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field is required" }
);
