import { en } from './en';
import { fr } from './fr';

export type Language = 'en' | 'fr';

export const LANGUAGES: readonly Language[] = ['en', 'fr'];

export const LANGUAGE_STORAGE_KEY = 'heraklios.language';

/** Widens `en`'s literal strings to `string` and keeps each function's
 * parameter list, so `fr` must supply the same keys with the same parameters
 * (spec B2): a missing, extra or wrongly-typed message is a `tsc` error. */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof en>;

const TABLES: Record<Language, Messages> = { en, fr };

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** The stored choice if it is a known language, else French for a French
 * browser and English for everything else (spec B3). */
export function resolveLanguage(stored: string | null | undefined, navigatorLanguage: string | null | undefined): Language {
  if (isLanguage(stored)) return stored;
  return (navigatorLanguage ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readNavigatorLanguage(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.language;
}

function applyToPage(lang: Language): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

let current: Language | null = null;

export function language(): Language {
  if (current === null) {
    current = resolveLanguage(readStored(), readNavigatorLanguage());
    applyToPage(current);
  }
  return current;
}

/** Sets and remembers the language. If storage is unavailable the choice
 * still holds for the session. */
export function setLanguage(lang: Language): void {
  current = lang;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Private mode / blocked storage: the in-memory choice is enough.
  }
  applyToPage(lang);
}

/** The current language's message table. */
export function messages(): Messages {
  return TABLES[language()];
}

export function messagesFor(lang: Language): Messages {
  return TABLES[lang];
}

/** Test hook: forget the cached choice so the next read re-resolves it. */
export function resetLanguageForTests(): void {
  current = null;
}
