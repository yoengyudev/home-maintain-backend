import { z } from "zod";
import { validateEmail } from "../email.validate";
import { validatePassword } from "../password.validate";
import { validateCambodiaPhone } from "../phone.validate";

const fcmTokenSchema = z.string().min(1, "FCM token is required");

const devicePlatformSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z
        .enum(["ANDROID", "IOS", "WEB", "UNKNOWN"], {
            message: "Platform must be one of: ANDROID, IOS, WEB, UNKNOWN",
        })
        .optional()
);

export const customerRegisterSchema = z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    email: z.string().email("Invalid email address").refine(validateEmail, "Invalid email address format"),
    password: z.string().refine(validatePassword, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
    fcmToken: fcmTokenSchema,
    platform: devicePlatformSchema,
    deviceName: z.string().min(1, "Device name cannot be empty").optional(),
});

export const customerVerifyRegisterOtpSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

export const customerResendRegisterOtpSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
});

export const customerLoginSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    password: z.string().min(1, "Password is required"),
    fcmToken: fcmTokenSchema,
    platform: devicePlatformSchema,
    deviceName: z.string().min(1, "Device name cannot be empty").optional(),
});

export const customerForgotPasswordSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
});

export const customerVerifyForgotPasswordOtpSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

export const customerResendForgotPasswordOtpSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
});

export const customerResetPasswordSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: z.string().refine(validatePassword, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
});

export const customerChangePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z
            .string()
            .refine(
                validatePassword,
                "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"
            ),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: "New password must be different from current password",
        path: ["newPassword"],
    });
