import { z } from "zod";

export const vendorSupportRequestSchema = z.object({
    category: z.enum(["technical", "verification", "booking", "services", "other"], {
        message: "Invalid support category",
    }),
    subject: z.string().trim().min(1, "Subject is required").max(160, "Subject is too long"),
    description: z.string().trim().min(1, "Description is required").max(4000, "Description is too long"),
    relatedBookingId: z.string().trim().max(80).optional().or(z.literal("")),
    relatedServiceId: z.string().trim().max(80).optional().or(z.literal("")),
});
