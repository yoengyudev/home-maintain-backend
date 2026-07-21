import { z } from "zod";

export const customerCreateReviewSchema = z.object({
    rating: z.coerce.number().min(1).max(5),
    comment: z.string().trim().min(1).max(2000),
});
