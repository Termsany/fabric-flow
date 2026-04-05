import { Globe } from "lucide-react";
import { useLang } from "@/contexts/LangContext";

interface LanguageSwitcherProps {
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = "light",
  compact = false,
  className = "",
}: LanguageSwitcherProps) {
  const { lang, setLang, t } = useLang();

  const nextLang = lang === "ar" ? "en" : "ar";
  const label = compact
    ? nextLang === "ar" ? t.arabicShort : t.englishShort
    : nextLang === "ar" ? t.switchToArabic : t.switchToEnglish;

  const palette =
    variant === "dark"
      ? "border border-indigo-700 bg-indigo-900/60 text-indigo-100 hover:bg-indigo-800"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={() => setLang(nextLang)}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${palette} ${className}`.trim()}
      aria-label={t.language}
      title={t.language}
    >
      <Globe size={16} className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}
