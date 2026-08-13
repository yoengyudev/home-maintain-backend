import { z } from "zod";
import { validateEmail } from "../email.validate";

const fcmTokenSchema = z.string().min(1, "FCM token is required");

const devicePlatformSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z
        .enum(["ANDROID", "IOS", "WEB", "UNKNOWN"], {
            message: "Platform must be one of: ANDROID, IOS, WEB, UNKNOWN",
        })
        .optional()
);

export const adminForgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email address")
        .refine(validateEmail, "Invalid email address format"),
});

export const adminVerifyOtpSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email address")
        .refine(validateEmail, "Invalid email address format"),
    otp: z.string().trim().length(6),
});

export const adminResetPasswordSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email address")
        .refine(validateEmail, "Invalid email address format"),
    otp: z.string().trim().length(6),
    newPassword: z.string().min(8),
});

export const adminLoginSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email address")
        .refine(validateEmail, "Invalid email address format"),
    password: z.string().min(1, "Password is required"),
    fcmToken: fcmTokenSchema,
    platform: devicePlatformSchema,
    deviceName: z.string().min(1, "Device name cannot be empty").optional(),
});

export const adminRefreshTokenSchema = z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
});
