import type { IncomingMessage, Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { UserRole } from "../generated/prisma/enums";
import { assertActiveCustomerSession } from "../helper/customer/auth.helper";
import { CustomerBookingsService } from "../services/customer/customer.bookings.service";
import { logger } from "../utils/logger.util";
import { verifyAccessToken } from "../utils/jwt.util";
import { subscribeBookingEvents, type BookingRealtimeEvent } from "./booking-events";

type ClientMessage = {
    type?: string;
    bookingId?: string;
};

type SocketMeta = {
    userId: string;
    lang: "en" | "kh";
    bookingIds: Set<string>;
};

const sockets = new Map<WebSocket, SocketMeta>();

function readUrl(req: IncomingMessage) {
    const host = req.headers.host || "localhost";
    return new URL(req.url || "/", `http://${host}`);
}

function readToken(req: IncomingMessage) {
    try {
        const url = readUrl(req);
        const queryToken = url.searchParams.get("token");
        if (queryToken) return queryToken;

        const auth = req.headers.authorization;
        if (auth?.startsWith("Bearer ")) return auth.slice(7);
        return null;
    } catch {
        return null;
    }
}

function sendJson(socket: WebSocket, payload: unknown) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}

function matchesBooking(meta: SocketMeta, event: BookingRealtimeEvent) {
    if (meta.userId && event.customerUserId && meta.userId === event.customerUserId) {
        if (meta.bookingIds.size === 0) return true;
    }
    return (
        meta.bookingIds.has(event.bookingId) ||
        meta.bookingIds.has(event.publicId)
    );
}

export function attachBookingWebSocket(server: Server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
        let pathname = "";
        try {
            pathname = readUrl(req).pathname;
        } catch {
            socket.destroy();
            return;
        }

        if (pathname !== "/ws/bookings") return;

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
        });
    });

    wss.on("connection", (socket, req) => {
        void handleConnection(socket, req);
    });

    const heartbeat = setInterval(() => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.ping();
            }
        });
    }, 30000);

    const unsubscribe = subscribeBookingEvents((event) => {
        void broadcastBookingUpdated(event);
    });

    wss.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
    });

    logger.info("Booking WebSocket attached at /ws/bookings");
    return wss;
}

async function broadcastBookingUpdated(event: BookingRealtimeEvent) {
    const targets = [...sockets.entries()].filter(([, meta]) => matchesBooking(meta, event));
    if (targets.length === 0) return;

    const payloads = new Map<string, unknown>();

    await Promise.all(
        targets.map(async ([socket, meta]) => {
            const cacheKey = `${meta.userId}:${meta.lang}`;
            if (!payloads.has(cacheKey)) {
                try {
                    const booking = await CustomerBookingsService.getById(
                        meta.userId,
                        event.publicId || event.bookingId,
                        meta.lang
                    );
                    payloads.set(cacheKey, booking);
                } catch (error) {
                    logger.error("Failed to load booking for websocket push:", error);
                    payloads.set(cacheKey, null);
                }
            }

            const booking = payloads.get(cacheKey);
            sendJson(socket, {
                type: "booking.updated",
                bookingId: event.publicId || event.bookingId,
                publicId: event.publicId,
                status: event.status,
                booking,
            });
        })
    );
}

async function handleConnection(socket: WebSocket, req: IncomingMessage) {
    const token = readToken(req);
    const decoded = token ? verifyAccessToken(token) : null;

    if (!decoded?.userId || decoded.role !== UserRole.CUSTOMER) {
        socket.close(4401, "Unauthorized");
        return;
    }

    try {
        await assertActiveCustomerSession(decoded.userId, decoded.sid, "en");
    } catch {
        socket.close(4401, "Unauthorized");
        return;
    }

    const url = readUrl(req);
    const lang = url.searchParams.get("lang") === "km" || url.searchParams.get("lang") === "kh"
        ? "kh"
        : "en";
    const initialBookingId = url.searchParams.get("bookingId")?.trim();
    const meta: SocketMeta = {
        userId: decoded.userId,
        lang,
        bookingIds: new Set(initialBookingId ? [initialBookingId] : []),
    };
    sockets.set(socket, meta);

    if (initialBookingId) {
        sendJson(socket, { type: "subscribed", bookingId: initialBookingId });
    }

    socket.on("message", (raw) => {
        void (async () => {
            let message: ClientMessage;
            try {
                message = JSON.parse(String(raw)) as ClientMessage;
            } catch {
                sendJson(socket, { type: "error", message: "Invalid message" });
                return;
            }

            if (message.type === "ping") {
                sendJson(socket, { type: "pong" });
                return;
            }

            if (message.type !== "subscribe" || !message.bookingId?.trim()) {
                sendJson(socket, { type: "error", message: "Unsupported message" });
                return;
            }

            meta.bookingIds.add(message.bookingId.trim());
            sendJson(socket, {
                type: "subscribed",
                bookingId: message.bookingId.trim(),
            });
        })();
    });

    const cleanup = () => {
        sockets.delete(socket);
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
}
