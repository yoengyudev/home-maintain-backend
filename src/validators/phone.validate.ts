export const normalizeCambodiaPhone = (phone: string): string => {
    if (typeof phone !== "string") return phone;

    const normalizedPhone = phone.replace(/\s+/g, "");
    if (normalizedPhone.startsWith("+855")) {
        return `0${normalizedPhone.slice(4)}`;
    }

    if (normalizedPhone.startsWith("855")) {
        return `0${normalizedPhone.slice(3)}`;
    }

    return normalizedPhone;
};

export const validateCambodiaPhone = (phone: string): boolean => {
    if (typeof phone !== "string") return false;

    const localPhone = normalizeCambodiaPhone(phone);

    // Accept only known Cambodia prefixes from the provided carrier list.
    const allowedPrefixes = [
        "010", "011", "012", "013", "014", "015", "016", "017", "018",
        "031",
        "060", "061", "066", "067", "068", "069", "070", "071", "076", "077", "078",
        "080", "081", "083", "084", "085", "086", "087", "088", "089",
        "090", "092", "093", "095", "096", "097", "098", "099",
    ];

    if (!/^0\d{8,9}$/.test(localPhone)) return false;

    const prefix = localPhone.slice(0, 3);
    return allowedPrefixes.includes(prefix);
};
