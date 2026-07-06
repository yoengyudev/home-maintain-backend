import { z } from "zod";
import { validateEmail } from "../email.validate";
import { validatePassword } from "../password.validate";
import { validateCambodiaPhone } from "../phone.validate";

export const vendorRegisterSchema = z.object({
    businessName: z.string().min(2, "Business name must be at least 2 characters"),
    contactName: z.string().min(2, "Contact name must be at least 2 characters"),
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    email: z.string().email("Invalid email address").refine(validateEmail, "Invalid email address format").optional().or(z.literal('')),
    password: z.string().refine(validatePassword, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
});

export const vendorLoginSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
});

export const resetPasswordSchema = z.object({
    phone: z.string().refine(validateCambodiaPhone, "Invalid Cambodia phone number"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
    newPassword: z.string().refine(validatePassword, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
});
