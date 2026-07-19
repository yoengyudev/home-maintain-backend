import { z } from "zod";
import { validateEmail } from "../email.validate";
import { validateCambodiaPhone } from "../phone.validate";

const optionalBooleanFromMultipart = z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        return value === true || value === "true" || value === "1";
    });

export const customerUpdateProfileSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
    email: z
        .string()
        .email("Invalid email address")
        .refine(validateEmail, "Invalid email address format")
        .optional(),
    phone: z
        .string()
        .refine(validateCambodiaPhone, "Invalid Cambodia phone number")
        .optional(),
    /** When true and no new avatar file is uploaded, removes the current avatar. */
    removeAvatar: optionalBooleanFromMultipart,
});
