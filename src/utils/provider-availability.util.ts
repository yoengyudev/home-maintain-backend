export type AvailabilitySlot = {
    id: string;
    start: string;
    end: string;
    label: string;
};

export type AvailabilityDayReason = "paused" | "closed" | "blocked";

export type AvailabilityDay = {
    date: string;
    dayName: string;
    available: boolean;
    reason: AvailabilityDayReason | null;
    slots: AvailabilitySlot[];
};

type WorkingRange = { start: string; end: string };

type BusinessAvailability = {
    workingDays?: string[] | null;
    workingHours?: unknown;
    unavailableDates?: Array<Date | string> | null;
    temporarilyPaused?: boolean | null;
    maxBookingsPerSlot?: number | null;
};

const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
] as const;

const DAY_ALIASES: Record<string, (typeof DAY_NAMES)[number]> = {
    sun: "Sunday",
    sunday: "Sunday",
    mon: "Monday",
    monday: "Monday",
    tue: "Tuesday",
    tues: "Tuesday",
    tuesday: "Tuesday",
    wed: "Wednesday",
    wednesday: "Wednesday",
    thu: "Thursday",
    thur: "Thursday",
    thurs: "Thursday",
    thursday: "Thursday",
    fri: "Friday",
    friday: "Friday",
    sat: "Saturday",
    saturday: "Saturday",
};

function normalizeDayName(value: string): string | null {
    const key = value.trim().toLowerCase();
    return DAY_ALIASES[key] ?? null;
}

function unwrapJson(raw: unknown): unknown {
    let parsed = raw;
    for (let i = 0; i < 3 && typeof parsed === "string"; i += 1) {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return raw;
        }
    }
    return parsed;
}

function parseWorkingHours(raw: unknown): Record<string, WorkingRange[]> {
    const parsed = unwrapJson(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const hours: Record<string, WorkingRange[]> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const dayName = normalizeDayName(key);
        if (!dayName || !Array.isArray(value)) continue;
        hours[dayName] = value
            .map((range) => {
                if (!range || typeof range !== "object") return null;
                const start = String((range as WorkingRange).start || "").trim();
                const end = String((range as WorkingRange).end || "").trim();
                if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
                return { start, end };
            })
            .filter((range): range is WorkingRange => Boolean(range));
    }
    return hours;
}

function toYmd(value: Date | string): string {
    if (typeof value === "string") return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
}

function todayYmdIct(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Phnom_Penh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
    const [year, month, day] = ymd.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));
    return next.toISOString().slice(0, 10);
}

function weekdayFromYmd(ymd: string): (typeof DAY_NAMES)[number] {
    const [year, month, day] = ymd.split("-").map(Number);
    return DAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function toMinutes(hhmm: string): number {
    const [hours, minutes] = hhmm.split(":").map(Number);
    return hours * 60 + minutes;
}

function formatClock(totalMinutes: number): string {
    const hours24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function buildSlots(ranges: WorkingRange[], date: string): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    for (const range of ranges) {
        let cursor = toMinutes(range.start);
        const end = toMinutes(range.end);
        while (cursor + 60 <= end) {
            const slotEnd = Math.min(cursor + 120, end);
            const startLabel = formatClock(cursor);
            const endLabel = formatClock(slotEnd);
            slots.push({
                id: `${date}-${String(cursor).padStart(4, "0")}`,
                start: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
                end: `${String(Math.floor(slotEnd / 60)).padStart(2, "0")}:${String(slotEnd % 60).padStart(2, "0")}`,
                label: `${startLabel} - ${endLabel}`,
            });
            cursor = slotEnd;
        }
    }
    return slots;
}

export function resolveSchedule(profile: BusinessAvailability | null | undefined) {
    const workingDays = (profile?.workingDays ?? [])
        .map((day) => normalizeDayName(String(day)))
        .filter((day): day is string => Boolean(day));
    const hours = parseWorkingHours(profile?.workingHours);
    return { workingDays, hours };
}

export function matchSlotCount(
    bookedCounts: Map<string, number> | Record<string, number> | undefined,
    ymd: string,
    slot: AvailabilitySlot
): number {
    if (!bookedCounts) return 0;
    const getCount = (k: string) => {
        if (bookedCounts instanceof Map) return bookedCounts.get(k) ?? 0;
        return (bookedCounts as Record<string, number>)[k] ?? 0;
    };

    const keys = [
        `${ymd}_${slot.id}`,
        `${ymd}_${slot.label.toLowerCase()}`,
        `${ymd}_${slot.start}-${slot.end}`,
        slot.id,
        slot.label.toLowerCase(),
        `${slot.start}-${slot.end}`,
    ];

    for (const key of keys) {
        const count = getCount(key);
        if (count > 0) return count;
    }
    return 0;
}

export function evaluateAvailabilityDay(
    profile: BusinessAvailability | null | undefined,
    ymd: string,
    bookedSlotCounts?: Map<string, number> | Record<string, number>
): AvailabilityDay {
    const dayName = weekdayFromYmd(ymd);
    if (profile?.temporarilyPaused) {
        return { date: ymd, dayName, available: false, reason: "paused", slots: [] };
    }

    const resolved = resolveSchedule(profile);
    const workingDays = new Set(resolved.workingDays);
    const blocked = new Set((profile?.unavailableDates ?? []).map(toYmd));
    const hours = resolved.hours;

    if (blocked.has(ymd)) {
        return { date: ymd, dayName, available: false, reason: "blocked", slots: [] };
    }

    if (workingDays.size > 0 && !workingDays.has(dayName)) {
        return { date: ymd, dayName, available: false, reason: "closed", slots: [] };
    }

    const ranges = hours[dayName] ?? [];
    const allSlots = ranges.length > 0 ? buildSlots(ranges, ymd) : [];

    if (allSlots.length === 0) {
        return { date: ymd, dayName, available: false, reason: "closed", slots: [] };
    }

    const maxCapacity = Math.max(1, profile?.maxBookingsPerSlot ?? 1);
    const availableSlots = allSlots.filter((slot) => {
        const count = matchSlotCount(bookedSlotCounts, ymd, slot);
        return count < maxCapacity;
    });

    if (availableSlots.length === 0) {
        return { date: ymd, dayName, available: false, reason: "closed", slots: [] };
    }

    return { date: ymd, dayName, available: true, reason: null, slots: availableSlots };
}

export function buildAvailabilityCalendar(
    profile: BusinessAvailability | null | undefined,
    days = 30,
    bookedSlotCounts?: Map<string, number> | Record<string, number>
): AvailabilityDay[] {
    const start = addDaysYmd(todayYmdIct(), 1);
    const count = Math.min(60, Math.max(7, days));
    return Array.from({ length: count }, (_, index) =>
        evaluateAvailabilityDay(profile, addDaysYmd(start, index), bookedSlotCounts)
    );
}

export function isSlotOnDay(day: AvailabilityDay, timeSlot: string): boolean {
    const token = timeSlot.trim().toLowerCase();
    return day.slots.some((slot) => {
        const label = slot.label.toLowerCase();
        const compact = `${slot.start}-${slot.end}`;
        return label === token || compact === token.replace(/\s/g, "") || slot.id === timeSlot;
    });
}

