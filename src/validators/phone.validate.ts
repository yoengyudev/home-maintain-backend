export const validateCambodiaPhone = (phone: string): boolean => {
    if (typeof phone !== "string") return false;

    const normalizedPhone = phone.replace(/\s+/g, "");
    let localPhone = normalizedPhone;

    // Normalize to local format starting with 0.
    if (localPhone.startsWith("+855")) {
        localPhone = `0${localPhone.slice(4)}`;
    } else if (localPhone.startsWith("855")) {
        localPhone = `0${localPhone.slice(3)}`;
    }

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
