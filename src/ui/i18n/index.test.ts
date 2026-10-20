import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE_KEY, language, resetLanguageForTests, resolveLanguage, setLanguage } from './index';

describe('resolveLanguage', () => {
  it('lets a stored language win over the browser', () => {
    expect(resolveLanguage('fr', 'en-US')).toBe('fr');
    expect(resolveLanguage('en', 'fr-FR')).toBe('en');
  });

  it('ignores a stored value that is not a known language', () => {
    expect(resolveLanguage('de', 'fr-FR')).toBe('fr');
    expect(resolveLanguage('de', 'en-GB')).toBe('en');
    expect(resolveLanguage('', 'fr')).toBe('fr');
  });

  it('picks French for any French browser locale, English otherwise', () => {
    expect(resolveLanguage(null, 'fr-CA')).toBe('fr');
    expect(resolveLanguage(null, 'fr')).toBe('fr');
    expect(resolveLanguage(null, 'FR-be')).toBe('fr');
    expect(resolveLanguage(null, 'de-DE')).toBe('en');
  });

  it('falls back to English with nothing at all', () => {
    expect(resolveLanguage(null, null)).toBe('en');
    expect(resolveLanguage(undefined, undefined)).toBe('en');
  });
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('the language store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLanguageForTests();
  });

  it('reads the stored choice, then the browser language', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [LANGUAGE_STORAGE_KEY]: 'fr' }));
    vi.stubGlobal('navigator', { language: 'en-US' });
    resetLanguageForTests();
    expect(language()).toBe('fr');

    vi.stubGlobal('localStorage', fakeStorage());
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    resetLanguageForTests();
    expect(language()).toBe('fr');
  });

  it('persists a choice under heraklios.language', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    setLanguage('fr');
    expect(storage.data['heraklios.language']).toBe('fr');
    expect(language()).toBe('fr');
  });

  it('still switches for the session when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', broken);
    setLanguage('fr');
    expect(language()).toBe('fr');
    setLanguage('en');
    expect(language()).toBe('en');
  });

  it('sets the page language', () => {
    const documentElement = { lang: 'en' };
    vi.stubGlobal('document', { documentElement });
    vi.stubGlobal('localStorage', fakeStorage());
    setLanguage('fr');
    expect(documentElement.lang).toBe('fr');
  });
});
