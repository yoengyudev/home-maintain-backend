import { Lang, MessageKey, messages } from "./messages";

export const t = (
    key: MessageKey,
    lang: Lang = "en",
    vars?: Record<string, string | number>
): string => {
    let text: string = messages[lang]?.[key] || messages.en[key];
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(value));
        }
    }
    return text;
};