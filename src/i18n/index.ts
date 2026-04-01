import { en } from "./en";
import { vi } from "./vi";

export type Language = "vi" | "en";
export type Translations = typeof vi;

const translations: Record<Language, Translations> = { vi, en };

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}

export { en, vi };
