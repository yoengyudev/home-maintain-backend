/**
 * Pluggable SMS delivery.
 *
 * Modes (SMS_PROVIDER):
 * - mock (default) — logs the message; no external call
 * - twilio — uses Twilio REST API when keys are set
 * - webhook — POSTs JSON to SMS_WEBHOOK_URL with Authorization: Bearer SMS_API_KEY
 *
 * When Twilio/webhook credentials are missing, falls back to mock so local
 * development keeps working. Set the keys later to enable real delivery.
 */

type SendSmsInput = {
    to: string;
    message: string;
};

type SendSmsResult = {
    provider: "mock" | "twilio" | "webhook";
    mocked: boolean;
};

const provider = (process.env.SMS_PROVIDER ?? "mock").toLowerCase();
const apiKey = process.env.SMS_API_KEY ?? "";
const apiSecret = process.env.SMS_API_SECRET ?? "";
const fromNumber = process.env.SMS_FROM_NUMBER ?? "";
const webhookUrl = process.env.SMS_WEBHOOK_URL ?? "";

const isTwilioConfigured = Boolean(apiKey && apiSecret && fromNumber);
const isWebhookConfigured = Boolean(webhookUrl && apiKey);

const resolveProvider = (): SendSmsResult["provider"] => {
    if (provider === "twilio" && isTwilioConfigured) return "twilio";
    if (provider === "webhook" && isWebhookConfigured) return "webhook";
    return "mock";
};

const sendViaTwilio = async ({ to, message }: SendSmsInput) => {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const body = new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message,
    });

    const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${apiKey}/Messages.json`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twilio SMS failed (${response.status}): ${errorText}`);
    }
};

const sendViaWebhook = async ({ to, message }: SendSmsInput) => {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, message }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook SMS failed (${response.status}): ${errorText}`);
    }
};

export const isSmsConfigured = (): boolean => resolveProvider() !== "mock";

export const sendSms = async (input: SendSmsInput): Promise<SendSmsResult> => {
    const activeProvider = resolveProvider();

    if (activeProvider === "twilio") {
        await sendViaTwilio(input);
        return { provider: "twilio", mocked: false };
    }

    if (activeProvider === "webhook") {
        await sendViaWebhook(input);
        return { provider: "webhook", mocked: false };
    }

    console.warn(`[SMS:mock] to=${input.to} message=${input.message}`);
    return { provider: "mock", mocked: true };
};
