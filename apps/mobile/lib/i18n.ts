import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import es from "../locales/es.json";
import en from "../locales/en.json";

const STORAGE_KEY = "@archivum/language";

export type Lang = "es" | "en";
export const SUPPORTED_LANGS: Lang[] = ["es", "en"];

/** Initialise i18n synchronously with a default, then refine from AsyncStorage. */
export function initI18n() {
  if (i18n.isInitialized) return;

  // Spanish is the product's primary language, so it is what we start in
  // regardless of the device locale. Only an explicit choice by the user
  // (persisted below) switches away from it.
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        es: { translation: es },
        en: { translation: en },
      },
      lng: "es",
      fallbackLng: "es",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
      returnNull: false,
    });

  // Refine with persisted preference (async, non-blocking)
  AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
    if (stored && SUPPORTED_LANGS.includes(stored as Lang) && stored !== i18n.language) {
      i18n.changeLanguage(stored);
    }
  }).catch(() => {});
}

/** Change app language and persist the choice. */
export async function setLanguage(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang);
  try { await AsyncStorage.setItem(STORAGE_KEY, lang); } catch {}
}

export default i18n;
