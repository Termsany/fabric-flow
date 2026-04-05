import type { Language } from "@/lib/i18n";

function getLocale(lang: Language) {
  return lang === "ar" ? "ar-EG" : "en-US";
}

export function formatDate(value: string | Date, lang: Language) {
  return new Intl.DateTimeFormat(getLocale(lang)).format(new Date(value));
}

export function formatDateTime(value: string | Date, lang: Language) {
  return new Intl.DateTimeFormat(getLocale(lang), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(value: number, lang: Language) {
  return new Intl.NumberFormat(getLocale(lang)).format(value);
}

export function formatCurrency(value: number, currency: string, lang: Language) {
  return new Intl.NumberFormat(getLocale(lang), {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(value);
}
