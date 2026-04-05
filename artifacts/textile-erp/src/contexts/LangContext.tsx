import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type Language, translations } from "@/lib/i18n";

interface LangContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof translations.ar;
  isRTL: boolean;
}

const LangContext = createContext<LangContextType>({
  lang: "ar",
  setLang: () => {},
  t: translations.ar,
  isRTL: true,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("textile_erp_lang") as Language) || "ar";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("textile_erp_lang", newLang);
  };

  useEffect(() => {
    const isRTL = lang === "ar";
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
    document.body.setAttribute("dir", isRTL ? "rtl" : "ltr");
    document.body.setAttribute("data-lang", lang);
  }, [lang]);

  const t = translations[lang];
  const isRTL = lang === "ar";

  return (
    <LangContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
