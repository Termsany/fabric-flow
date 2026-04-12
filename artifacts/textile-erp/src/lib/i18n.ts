import ar from "@/locales/ar/translation.json";
import en from "@/locales/en/translation.json";

export type Language = "ar" | "en";

export const translations = {
  ar,
  en,
} as const;

export type TranslationKey = keyof typeof translations.ar;
