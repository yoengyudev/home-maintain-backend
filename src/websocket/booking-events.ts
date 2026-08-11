export type BookingRealtimeEvent = {
    type: "booking.updated";
    bookingId: string;
    publicId: string;
    status: string;
    customerUserId?: string;
};

type BookingEventListener = (event: BookingRealtimeEvent) => void;

const listeners = new Set<BookingEventListener>();

export function publishBookingUpdated(input: {
    bookingId: string;
    publicId?: string | null;
    status: string;
    customerUserId?: string | null;
}) {
    const publicId = input.publicId || input.bookingId;
    const event: BookingRealtimeEvent = {
        type: "booking.updated",
        bookingId: input.bookingId,
        publicId,
        status: input.status,
        customerUserId: input.customerUserId || undefined,
    };

    listeners.forEach((listener) => {
        try {
            listener(event);
        } catch {
            // Ignore listener failures so one socket cannot break others.
        }
    });
}

export function subscribeBookingEvents(listener: BookingEventListener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
