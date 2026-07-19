import crypto from "crypto";
import {
    buildOtpSmsMessage,
    generateOtpCode,
    getOtpExpirySeconds,
    getOtpMaxAttempts,
    hashOtpCode,
    verifyOtpCode,
} from "../../utils/otp.util";
import { isSmsConfigured, sendSms } from "../../utils/sms.util";
import { BadRequestException } from "../../utils/app-error.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

export type OtpPurpose =
    | "CUSTOMER_REGISTER"
    | "CUSTOMER_FORGOT_PASSWORD"
    | "CUSTOMER_PASSWORD_RESET"
    | "VENDOR_FORGOT_PASSWORD";

type OtpChallenge<TPayload = unknown> = {
    phone: string;
    purpose: OtpPurpose;
    codeHash: string;
    payload: TPayload;
    attempts: number;
    expiresAt: number;
    createdAt: number;
};

const challenges = new Map<string, OtpChallenge>();

const challengeKey = (purpose: OtpPurpose, phone: string) => `${purpose}:${phone}`;

const purgeExpired = (key: string, challenge?: OtpChallenge) => {
    if (!challenge) return;
    if (Date.now() > challenge.expiresAt) {
        challenges.delete(key);
    }
};

export class OtpService {
    static async createAndSend<TPayload>(params: {
        phone: string;
        purpose: OtpPurpose;
        payload: TPayload;
    }) {
        const { phone, purpose, payload } = params;
        const useMockCode = !isSmsConfigured();
        const code = generateOtpCode(useMockCode);
        const expiresIn = getOtpExpirySeconds();
        const key = challengeKey(purpose, phone);

        challenges.set(key, {
            phone,
            purpose,
            codeHash: hashOtpCode(code),
            payload,
            attempts: 0,
            expiresAt: Date.now() + expiresIn * 1000,
            createdAt: Date.now(),
        });

        const delivery = await sendSms({
            to: phone,
            message: buildOtpSmsMessage(code),
        });

        return {
            phone,
            expiresIn,
            mocked: delivery.mocked,
            // Exposed only in mock mode so local/dev clients can complete the flow.
            ...(delivery.mocked ? { debugOtp: code } : {}),
        };
    }

    static async resend(phone: string, purpose: OtpPurpose, lang: Lang = "en") {
        const key = challengeKey(purpose, phone);
        const existing = challenges.get(key);
        purgeExpired(key, existing);

        if (!challenges.has(key) || !existing) {
            throw new BadRequestException(t("OTP_PENDING_NOT_FOUND", lang));
        }

        return this.createAndSend({
            phone,
            purpose,
            payload: existing.payload,
        });
    }

    static consume<TPayload>(phone: string, purpose: OtpPurpose, code: string, lang: Lang = "en"): TPayload {
        const key = challengeKey(purpose, phone);
        const challenge = challenges.get(key) as OtpChallenge<TPayload> | undefined;
        purgeExpired(key, challenge);

        const active = challenges.get(key) as OtpChallenge<TPayload> | undefined;
        if (!active) {
            throw new BadRequestException(t("OTP_EXPIRED_OR_NOT_FOUND", lang));
        }

        if (active.attempts >= getOtpMaxAttempts()) {
            challenges.delete(key);
            throw new BadRequestException(t("OTP_TOO_MANY_ATTEMPTS", lang));
        }

        if (!verifyOtpCode(code, active.codeHash)) {
            active.attempts += 1;
            challenges.set(key, active);
            throw new BadRequestException(t("OTP_INVALID_CODE", lang));
        }

        challenges.delete(key);
        return active.payload;
    }

    static createResetToken<TPayload>(params: {
        phone: string;
        purpose: OtpPurpose;
        payload: TPayload;
    }) {
        const { phone, purpose, payload } = params;
        const resetToken = crypto.randomUUID();
        const expiresIn = getOtpExpirySeconds();
        const key = challengeKey(purpose, phone);

        challenges.set(key, {
            phone,
            purpose,
            codeHash: hashOtpCode(resetToken),
            payload,
            attempts: 0,
            expiresAt: Date.now() + expiresIn * 1000,
            createdAt: Date.now(),
        });

        return {
            phone,
            resetToken,
            expiresIn,
        };
    }

    static peekPayload<TPayload>(phone: string, purpose: OtpPurpose): TPayload | null {
        const key = challengeKey(purpose, phone);
        const challenge = challenges.get(key) as OtpChallenge<TPayload> | undefined;
        purgeExpired(key, challenge);
        return (challenges.get(key) as OtpChallenge<TPayload> | undefined)?.payload ?? null;
    }
}
