import { z } from "zod";
import { validateEmail } from "../email.validate";
import { validatePassword } from "../password.validate";
import { normalizeCambodiaPhone, validateCambodiaPhone } from "../phone.validate";

const fcmTokenSchema = z.string().min(1, "FCM token is required");

const devicePlatformSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z
        .enum(["ANDROID", "IOS", "WEB", "UNKNOWN"], {
            message: "Platform must be one of: ANDROID, IOS, WEB, UNKNOWN",
        })
        .optional()
);

export const vendorRegisterSchema = z.object({
    businessName: z.string().min(2, "Business name must be at least 2 characters"),
    contactName: z.string().min(2, "Contact name must be at least 2 characters"),
    phone: z.string()
        .transform(normalizeCambodiaPhone)
        .refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    email: z.string().email("Invalid email address").refine(validateEmail, "Invalid email address format").optional().or(z.literal('')),
    password: z.string().refine(validatePassword, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
});

export const vendorLoginSchema = z.object({
    phone: z.string()
        .transform(normalizeCambodiaPhone)
        .refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    password: z.string().min(1, "Password is required"),
    fcmToken: fcmTokenSchema,
    platform: devicePlatformSchema,
    deviceName: z.string().min(1, "Device name cannot be empty").optional(),
});

export const forgotPasswordSchema = z.object({
    phone: z.string()
        .transform(normalizeCambodiaPhone)
        .refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
});

export const vendorChangePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().refine(
        validatePassword,
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
}).refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
});

export const vendorDeleteAccountSchema = z.object({
    password: z.string().min(1, "Password is required"),
});

export const resetPasswordSchema = z.object({
    phone: z.string()
        .transform(normalizeCambodiaPhone)
        .refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
    newPassword: z.string().refine(validatePassword, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
});
