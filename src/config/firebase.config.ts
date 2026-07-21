import "dotenv/config";
import fs from "fs";
import path from "path";
import admin from "firebase-admin";

let initialized = false;
let available = false;

function buildCredential(): admin.credential.Credential | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
    if (!raw) {
        console.warn(
            "[FCM] FIREBASE_SERVICE_ACCOUNT_KEY is not set. Push notifications are disabled."
        );
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as admin.ServiceAccount;
        return admin.credential.cert(parsed);
    } catch {
        // Not JSON -> treat as path to service-account file
    }

    try {
        const keyPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
        const fileContent = fs.readFileSync(keyPath, "utf8");
        const serviceAccount = JSON.parse(fileContent) as admin.ServiceAccount;
        return admin.credential.cert(serviceAccount);
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
        if (admin.apps.length) {
            available = true;
            return true;
        }

        const credential = buildCredential();
        if (!credential) {
            available = false;
            return false;
        }

        admin.initializeApp({ credential });
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

export function getFirebaseMessaging() {
    if (!ensureInitialized()) return null;
    return admin.messaging();
}

export const firebaseAdmin = admin;
