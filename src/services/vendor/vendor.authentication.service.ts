import crypto from "crypto";
import { prisma } from "../../database/prisma.client";
import { hashPassword } from "../../utils/password.util";
import { verifyPassword } from "../../utils/verify-password.util";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.util";
import { BadRequestException, NotFoundException, UnauthorizedException } from "../../utils/app-error.util";
import type { z } from "zod";
import type { vendorRegisterSchema, vendorLoginSchema, forgotPasswordSchema, resetPasswordSchema } from "../../validators/vendor/vendor.auth.validator";
import { UserRole, ProviderStatus } from "../../generated/prisma/enums";

type RegisterDto = z.infer<typeof vendorRegisterSchema>;
type LoginDto = z.infer<typeof vendorLoginSchema>;
type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export class VendorAuthenticationService {
    static async register(data: RegisterDto) {
        const { businessName, email, password, contactName, phone } = data;

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { phone },
                    ...(email ? [{ email }] : [])
                ]
            }
        });

        if (existingUser) {
            throw new BadRequestException("Phone or email already exists");
        }

        const hashedPassword = await hashPassword(password);
        const publicId = crypto.randomUUID();

        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: email || undefined,
                    phone,
                    passwordHash: hashedPassword,
                    role: UserRole.PROVIDER,
                    publicId,
                    providerProfile: {
                        create: {
                            publicId: crypto.randomUUID(),
                            contactName,
                            status: ProviderStatus.PENDING_VERIFICATION,
                            businessProfile: {
                                create: {
                                    businessName
                                }
                            }
                        }
                    }
                },
                include: {
                    providerProfile: {
                        include: {
                            businessProfile: true
                        }
                    }
                }
            });

            return user;
        });

        const tokenPayload = {
            userId: result.id,
            role: result.role,
        };

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);

        // Store session
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await prisma.accountSession.create({
            data: {
                publicId: crypto.randomUUID(),
                userId: result.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });

        return {
            user: {
                publicId: result.publicId,
                email: result.email,
                phone: result.phone,
                role: result.role,
                profile: result.providerProfile
            },
            accessToken,
            refreshToken
        };
    }

    static async login(data: LoginDto) {
        const { phone, password } = data;

        const user = await prisma.user.findUnique({
            where: { phone },
            include: { 
                providerProfile: {
                    include: {
                        businessProfile: true
                    }
                }
            }
        });

        if (!user || user.role !== UserRole.PROVIDER || !user.passwordHash) {
            throw new UnauthorizedException("Incorrect phone number or password");
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException("Incorrect phone number or password");
        }

        const tokenPayload = {
            userId: user.id,
            role: user.role,
        };

        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken(tokenPayload);

        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await prisma.accountSession.create({
            data: {
                publicId: crypto.randomUUID(),
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        return {
            user: {
                publicId: user.publicId,
                email: user.email,
                phone: user.phone,
                role: user.role,
                profile: user.providerProfile
            },
            accessToken,
            refreshToken
        };
    }

    static async forgotPassword(data: ForgotPasswordDto) {
        const { phone } = data;

        const user = await prisma.user.findUnique({
            where: { phone }
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            // We shouldn't throw error to prevent user enumeration, but for simplicity:
            throw new NotFoundException("User not found");
        }

        // Mock sending OTP
        const otp = "123456";
        
        return {
            message: "OTP sent to phone",
            phone
        };
    }

    static async resetPassword(data: ResetPasswordDto) {
        const { phone, otp, newPassword } = data;

        // Mock verification
        if (otp !== "123456") {
            throw new BadRequestException("Invalid verification code");
        }

        const user = await prisma.user.findUnique({
            where: { phone }
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException("User not found");
        }

        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword }
        });

        // Optionally revoke all existing sessions to force re-login
        await prisma.accountSession.updateMany({
            where: { userId: user.id },
            data: { revokedAt: new Date() }
        });

        return {
            message: "Password reset successfully"
        };
    }

    static async logout(userId: string, authHeader: string) {
        const token = authHeader.split(" ")[1];
        if (!token) return;

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        await prisma.accountSession.updateMany({
            where: {
                userId,
                tokenHash
            },
            data: {
                revokedAt: new Date()
            }
        });
    }

    static async me(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { 
                providerProfile: {
                    include: {
                        businessProfile: true
                    }
                } 
            }
        });

        if (!user || user.role !== UserRole.PROVIDER) {
            throw new NotFoundException("User not found");
        }

        return {
            publicId: user.publicId,
            email: user.email,
            phone: user.phone,
            role: user.role,
            profile: user.providerProfile
        };
    }
}
