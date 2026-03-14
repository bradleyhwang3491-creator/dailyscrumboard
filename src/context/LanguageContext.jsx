import { createContext, useContext, useState, useCallback } from "react";
import { ko } from "../locales/ko";
import { en } from "../locales/en";

const LOCALES = { ko, en };
const STORAGE_KEY = "scrumboard_lang";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "ko"
  );

  const setLang = useCallback((l) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);

  /* t("common.logout") → 해당 언어 텍스트 반환 */
  const t = useCallback(
    (key) => {
      const locale = LOCALES[lang] || LOCALES.ko;
      const parts = key.split(".");
      let val = locale;
      for (const p of parts) {
        if (val == null) break;
        val = val[p];
      }
      if (val == null) {
        // fallback to ko
        let fb = LOCALES.ko;
        for (const p of parts) {
          if (fb == null) break;
          fb = fb[p];
        }
        return fb ?? key;
      }
      return val;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
