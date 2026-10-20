import { describe, expect, it } from 'vitest';
import { messagesFor, type Language } from './index';

/** Messages that are legitimately the same in both languages. */
const SAME_IN_BOTH = new Set([
  'languageNames.en',
  'languageNames.fr',
  'units.archers',
  'phases.combat',
  'edges.E',
  'edges.N',
  'edges.S',
  'menu.minutes',
  'menu.hours',
]);

/** Every leaf message of a table, functions called with sample values. */
function flatten(value: unknown, path: string, out: Map<string, string>): void {
  if (typeof value === 'string') {
    out.set(path, value);
  } else if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => string;
    out.set(path, fn(...Array.from({ length: fn.length }, () => ['Alpha', 'Beta'])));
  } else if (Array.isArray(value)) {
    value.forEach((child, i) => flatten(child, `${path}.${i}`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, path ? `${path}.${key}` : key, out);
  }
}

function table(lang: Language): Map<string, string> {
  const out = new Map<string, string>();
  flatten(messagesFor(lang), '', out);
  return out;
}

describe('message tables', () => {
  it('have the same messages in both languages', () => {
    expect([...table('fr').keys()]).toEqual([...table('en').keys()]);
  });

  it.each(['en', 'fr'] as Language[])('have no empty message in %s', (lang) => {
    for (const [path, text] of table(lang)) expect(text.trim(), `${lang} ${path}`).not.toBe('');
  });

  it('translate every message except the listed ones', () => {
    const en = table('en');
    const fr = table('fr');
    for (const [path, text] of en) {
      if (SAME_IN_BOTH.has(path)) continue;
      expect(fr.get(path), path).not.toBe(text);
    }
  });
});
