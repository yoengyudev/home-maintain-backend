export type BookingRealtimeEvent = {
    type: "booking.updated" | "booking.created";
    bookingId: string;
    publicId: string;
    status: string;
    customerUserId?: string;
    providerUserId?: string;
};

type BookingEventListener = (event: BookingRealtimeEvent) => void;

const listeners = new Set<BookingEventListener>();

function publish(event: BookingRealtimeEvent) {
    listeners.forEach((listener) => {
        try {
            listener(event);
        } catch {
            // Ignore listener failures so one socket cannot break others.
        }
    });
}

export function publishBookingUpdated(input: {
    bookingId: string;
    publicId?: string | null;
    status: string;
    customerUserId?: string | null;
    providerUserId?: string | null;
}) {
    const publicId = input.publicId || input.bookingId;
    publish({
        type: "booking.updated",
        bookingId: input.bookingId,
        publicId,
        status: input.status,
        customerUserId: input.customerUserId || undefined,
        providerUserId: input.providerUserId || undefined,
    });
}

export function publishBookingCreated(input: {
    bookingId: string;
    publicId?: string | null;
    status: string;
    customerUserId?: string | null;
    providerUserId?: string | null;
}) {
    const publicId = input.publicId || input.bookingId;
    publish({
        type: "booking.created",
        bookingId: input.bookingId,
        publicId,
        status: input.status,
        customerUserId: input.customerUserId || undefined,
        providerUserId: input.providerUserId || undefined,
    });
}

export function subscribeBookingEvents(listener: BookingEventListener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
