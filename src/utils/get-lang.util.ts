import { Lang } from "../i18n/messages";

export const getLang = (req: any): Lang => {
    const lang = String(req.headers["accept-language"] ?? "")
        .split(",")[0]
        ?.trim()
        .toLowerCase();

    // Dashboard uses "km"; backend message catalog uses "kh"
    if (lang === "kh" || lang === "km" || lang.startsWith("km-") || lang.startsWith("kh-")) {
        return "kh";
    }
    return "en";
};