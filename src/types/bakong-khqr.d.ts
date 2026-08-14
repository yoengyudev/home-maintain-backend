declare module 'bakong-khqr' {
  export interface KhqrCurrency {
    khr: number;
    usd: number;
  }

  export interface KhqrData {
    currency: KhqrCurrency;
    [key: string]: any;
  }

  export const khqrData: KhqrData;

  export class IndividualInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      optional?: {
        currency?: number;
        amount?: number;
        billNumber?: string;
        storeLabel?: string;
        terminalLabel?: string;
        mobileNumber?: string;
        purposeOfTransaction?: string;
        expirationTimestamp?: number;
        [key: string]: any;
      }
    );
  }

  export class MerchantInfo extends IndividualInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      merchantID: string,
      acquiringBank: string,
      optional?: Record<string, any>
    );
  }

  export interface KhqrResponse {
    status: {
      code: number;
      errorCode: number | null;
      message: string | null;
    };
    data: {
      qr: string;
      md5?: string;
    } | null;
  }

  export class BakongKHQR {
    generateIndividual(info: IndividualInfo): KhqrResponse;
    generateMerchant(info: MerchantInfo): KhqrResponse;
    checkPayment?(data: any): any;
  }
}
