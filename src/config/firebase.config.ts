import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert, getApps, type ServiceAccount } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let initialized = false;
let available = false;

function buildCredential() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
    if (!raw) {
        console.warn(
            "[FCM] FIREBASE_SERVICE_ACCOUNT_KEY is not set. Push notifications are disabled."
        );
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as ServiceAccount;
        return cert(parsed);
    } catch {
        // Not JSON -> treat as path to service-account file
    }

    try {
        const keyPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
        const fileContent = fs.readFileSync(keyPath, "utf8");
        const serviceAccount = JSON.parse(fileContent) as ServiceAccount;
        return cert(serviceAccount);
    } catch (error) {
        console.warn(
            "[FCM] Failed to load Firebase credentials:",
            error instanceof Error ? error.message : error
        );
        return null;
    }
}

function ensureInitialized() {
    if (initialized) return available;
    initialized = true;

    try {
        if (getApps().length > 0) {
            available = true;
            return true;
        }

        const credential = buildCredential();
        if (!credential) {
            available = false;
            return false;
        }

        initializeApp({ credential });
        available = true;
        console.log("[FCM] firebase-admin initialized");
        return true;
    } catch (error) {
        available = false;
        console.warn(
            "[FCM] firebase-admin init failed:",
            error instanceof Error ? error.message : error
        );
        return false;
    }
}

export function getFirebaseMessaging(): Messaging | null {
    if (!ensureInitialized()) return null;
    return getMessaging();
}

