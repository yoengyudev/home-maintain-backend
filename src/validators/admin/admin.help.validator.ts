import { z } from "zod";

export const faqAudienceSchema = z.enum(["CUSTOMER", "PROVIDER"]);
export const supportRequestStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);
export const supportPageKeySchema = z.enum(["ABOUT", "MISSION", "PROVIDER_CONTACT"]);

export const createFaqSchema = z.object({
    audience: faqAudienceSchema,
    category: z.string().trim().min(1).max(60).default("general"),
    questionEn: z.string().trim().min(1, "English question is required").max(300),
    questionKm: z.string().trim().min(1, "Khmer question is required").max(300),
    answerEn: z.string().trim().min(1, "English answer is required").max(4000),
    answerKm: z.string().trim().min(1, "Khmer answer is required").max(4000),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    relatedRoute: z.string().trim().max(160).optional().or(z.literal("")),
    relatedRouteLabelEn: z.string().trim().max(80).optional().or(z.literal("")),
    relatedRouteLabelKm: z.string().trim().max(80).optional().or(z.literal("")),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
});

export const updateFaqSchema = createFaqSchema.partial();

export const updateSupportPageSchema = z.object({
    contentEn: z.record(z.string(), z.unknown()).optional(),
    contentKm: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional(),
});

export const updateSupportRequestSchema = z.object({
    status: supportRequestStatusSchema,
});
