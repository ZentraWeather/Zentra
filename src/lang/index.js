import fr from "./fr/strings";
import nl from "./nl/strings";
import de from "./de/strings";
import en from "./en/strings";

export const LOCALES = ["fr", "nl", "de", "en"];

export const TRANSLATIONS = { fr, nl, de, en };

// Fallback automatique : s'il manque une clé dans nl/de/en, on prend fr.
export function getT(lang) {
  const base = TRANSLATIONS.fr;
  const dict = TRANSLATIONS[lang] || {};
  return { ...base, ...dict };
}
