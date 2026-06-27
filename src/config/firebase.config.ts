import "dotenv/config";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const buildCredential = (): admin.credential.Credential => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
    if (!raw) {
        return admin.credential.applicationDefault();
    }

    try {
        const parsed = JSON.parse(raw) as admin.ServiceAccount;
        return admin.credential.cert(parsed);
    } catch {
        // Not JSON -> treat as path to service-account file
    }

    const keyPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    const fileContent = fs.readFileSync(keyPath, "utf8");
    const serviceAccount = JSON.parse(fileContent) as admin.ServiceAccount;
    return admin.credential.cert(serviceAccount);
};


if (!admin.apps.length) {
    admin.initializeApp({
        credential: buildCredential(),
    });
}

export const firebaseAdmin = admin;