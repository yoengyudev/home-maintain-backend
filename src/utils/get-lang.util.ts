import { Lang } from "../i18n/messages";

export const getLang = (req: any): Lang => {
    const lang = req.headers["accept-language"];

    if (lang === "kh") return "kh";
    return "en";
};