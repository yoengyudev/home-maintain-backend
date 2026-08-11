import { z } from "zod";

export const createAdminNoteSchema = z.object({
    body: z.string().trim().min(1).max(500),
    relatedModule: z.string().trim().min(1),
    relatedRecordId: z.string().trim().min(1),
    relatedRoute: z.string().trim().max(200).optional(),
});
