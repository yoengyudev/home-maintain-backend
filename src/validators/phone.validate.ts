/**
 * Convert any accepted Cambodia phone input to local `0XXXXXXXX` form.
 * Accepts `+855…`, `855…`, or `0…` and strips spaces / dashes / parens.
 */
export const toLocalCambodiaPhone = (phone: string): string => {
    const stripped = phone.replace(/[\s\-()]/g, "");
    let localPhone = stripped;

    if (localPhone.startsWith("+855")) {
        localPhone = `0${localPhone.slice(4)}`;
    } else if (localPhone.startsWith("855")) {
        localPhone = `0${localPhone.slice(3)}`;
    }

    return localPhone;
};

/**
 * Canonical storage/lookup format. The database stores phones in E.164
 * (`+855XXXXXXXX`), so all register/login/OTP flows normalize to this.
 */
export const normalizeCambodiaPhone = (phone: string): string => {
    const localPhone = toLocalCambodiaPhone(phone);

    if (localPhone.startsWith("0")) {
        return `+855${localPhone.slice(1)}`;
    }

    return localPhone;
};

export const validateCambodiaPhone = (phone: string): boolean => {
    if (typeof phone !== "string") return false;

    const localPhone = toLocalCambodiaPhone(phone);

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
