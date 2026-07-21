import { getFirebaseMessaging } from "../config/firebase.config";
import { prisma } from "../database/prisma.client";

type PushPayload = {
    title: string;
    body: string;
    data?: Record<string, string>;
};

/**
 * Sends an FCM push to all active tokens for a user.
 * Invalid / expired tokens are deactivated.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
        const messaging = getFirebaseMessaging();
        if (!messaging) return;

        const tokens = await prisma.fcmToken.findMany({
            where: { userId, isActive: true },
            select: { id: true, token: true },
        });

        if (tokens.length === 0) return;

        const data: Record<string, string> = {};
        if (payload.data) {
            for (const [key, value] of Object.entries(payload.data)) {
                if (value != null) data[key] = String(value);
            }
        }
        data.title = payload.title;
        data.body = payload.body;

        const response = await messaging.sendEachForMulticast({
            tokens: tokens.map((row) => row.token),
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data,
            webpush: {
                fcmOptions: {
                    link: payload.data?.url || "/notifications",
                },
            },
        });

        const invalidTokenIds: string[] = [];
        response.responses.forEach((result: any, index: number) => {
            if (result.success) return;
            const code = result.error?.code || "";
            if (
                code.includes("registration-token-not-registered") ||
                code.includes("invalid-registration-token") ||
                code.includes("invalid-argument")
            ) {
                invalidTokenIds.push(tokens[index].id);
            }
        });

        if (invalidTokenIds.length > 0) {
            await prisma.fcmToken.updateMany({
                where: { id: { in: invalidTokenIds } },
                data: { isActive: false },
            });
        }
    } catch (error) {
        console.warn("[FCM] push failed:", error instanceof Error ? error.message : error);
    }
}

/**
 * Fire-and-forget wrapper so notification writes never fail because of FCM.
 */
export function sendPushToUserSafe(userId: string, payload: PushPayload): void {
    void sendPushToUser(userId, payload).catch((error) => {
        console.warn("[FCM] push failed:", error instanceof Error ? error.message : error);
    });
}
