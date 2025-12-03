import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import frTranslations from "./locales/fr.json";
import enTranslations from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        translation: frTranslations,
      },
      en: {
        translation: enTranslations,
      },
    },
    fallbackLng: "fr", // French as default fallback
    lng: "fr", // Set French as default language (used if detection fails)
    debug: false,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng", // localStorage key
      // If no language detected, it will use fallbackLng ("fr")
    },
  });

export default i18n;

