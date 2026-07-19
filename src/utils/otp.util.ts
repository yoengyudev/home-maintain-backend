import crypto from "crypto";

const OTP_LENGTH = Number(process.env.OTP_LENGTH ?? "6");
const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS ?? "300");
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? "5");
/** Fixed code used only when SMS is mocked (no provider keys). */
const OTP_MOCK_CODE = process.env.OTP_MOCK_CODE ?? "123456";

export const getOtpExpirySeconds = () => OTP_EXPIRY_SECONDS;
export const getOtpMaxAttempts = () => OTP_MAX_ATTEMPTS;
export const getOtpMockCode = () => OTP_MOCK_CODE;

export const generateOtpCode = (useMockCode = false): string => {
    if (useMockCode) {
        return OTP_MOCK_CODE.padStart(OTP_LENGTH, "0").slice(0, OTP_LENGTH);
    }

    const max = 10 ** OTP_LENGTH;
    const code = crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
    return code;
};

export const hashOtpCode = (code: string): string => {
    return crypto.createHash("sha256").update(code).digest("hex");
};

export const verifyOtpCode = (code: string, codeHash: string): boolean => {
    const incomingHash = hashOtpCode(code);
    const incoming = Buffer.from(incomingHash);
    const stored = Buffer.from(codeHash);

    if (incoming.length !== stored.length) return false;
    return crypto.timingSafeEqual(incoming, stored);
};

export const buildOtpSmsMessage = (code: string): string => {
    return `Your FixItHome verification code is ${code}. It expires in ${Math.floor(OTP_EXPIRY_SECONDS / 60)} minutes.`;
};
