import { BakongKHQR, IndividualInfo, khqrData } from "bakong-khqr";
import QRCode from "qrcode";

export interface BakongInvoiceQrResult {
    accountId: string;
    merchantName: string;
    merchantCity: string;
    currency: "USD" | "KHR";
    amount: number;
    qrString: string;
    qrImage: string;
    md5: string;
}

export class BakongService {
    private static khqr = new BakongKHQR();

    static getAccountId(): string {
        return process.env.BAKONG_ACCOUNT_ID || "sokhan_kheav@bkrt";
    }

    static getMerchantName(): string {
        return process.env.BAKONG_MERCHANT_NAME || "FitItHome";
    }

    static getMerchantCity(): string {
        return process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";
    }

    static getExpirationMinutes(): number {
        const raw = process.env.BAKONG_QR_EXPIRATION_MINUTES;
        const parsed = raw ? parseInt(raw, 10) : 0;
        return parsed > 0 ? parsed : 43200; // default 30 days
    }

    /**
     * Generate dynamic Bakong KHQR for an invoice platform service fee.
     */
    static async generateInvoicePaymentQr(params: {
        billNumber: string;
        amount: number;
        currency?: "USD" | "KHR";
        storeLabel?: string;
        terminalLabel?: string;
        purpose?: string;
        dueAt?: Date | null;
    }): Promise<BakongInvoiceQrResult | null> {
        try {
            const accountId = this.getAccountId();
            const merchantName = this.getMerchantName();
            const merchantCity = this.getMerchantCity();
            const currencyStr = (params.currency || process.env.BAKONG_CURRENCY || "USD").toUpperCase();
            const currencyCode = currencyStr === "KHR" ? khqrData.currency.khr : khqrData.currency.usd;

            // Calculate expiration timestamp (must always be in future)
            let expirationTimestamp = Date.now() + this.getExpirationMinutes() * 60 * 1000;
            if (params.dueAt && params.dueAt.getTime() > Date.now()) {
                expirationTimestamp = params.dueAt.getTime();
            }

            const cleanBillNumber = (params.billNumber || "").slice(0, 25);
            const cleanStoreLabel = (params.storeLabel || "FixItHome").slice(0, 25);
            const cleanTerminalLabel = (params.terminalLabel || "Online").slice(0, 25);
            const cleanPurpose = (params.purpose || "Platform Fee").slice(0, 25);

            const info = new IndividualInfo(
                accountId,
                merchantName,
                merchantCity,
                {
                    currency: currencyCode,
                    amount: Number(params.amount.toFixed(2)),
                    billNumber: cleanBillNumber,
                    storeLabel: cleanStoreLabel,
                    terminalLabel: cleanTerminalLabel,
                    purposeOfTransaction: cleanPurpose,
                    expirationTimestamp,
                }
            );

            const response = this.khqr.generateIndividual(info);
            if (!response || response.status?.code !== 0 || !response.data?.qr) {
                console.warn("[BakongService] Failed to generate KHQR:", response?.status?.message || response?.status);
                return null;
            }

            const qrString = response.data.qr;
            const md5 = response.data.md5 || "";

            // Generate clean high-resolution QR image data URL
            const qrImage = await QRCode.toDataURL(qrString, {
                margin: 1,
                width: 320,
                errorCorrectionLevel: "M",
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });

            return {
                accountId,
                merchantName,
                merchantCity,
                currency: currencyStr as "USD" | "KHR",
                amount: params.amount,
                qrString,
                qrImage,
                md5,
            };
        } catch (err) {
            console.error("[BakongService] Error generating KHQR QR:", err);
            return null;
        }
    }
}
