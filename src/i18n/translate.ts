import { Lang, MessageKey, messages } from "./messages";

export const t = (key: MessageKey, lang: Lang = "en"): string => {
    return messages[lang]?.[key] || messages.en[key];
};