// AC1 (intents/35-game-languages/spec.md): no text reaches the player except
// through the message tables. This reads every .ts file in src/scenes and
// src/ui (not tests, not i18n/ itself) and fails on a string or template
// literal with a word of two or more letters passed to a text-showing call.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const DIRS = ['scenes', 'ui'];

/** Calls that show text, and which top-level argument is the text. */
const CALLS: { pattern: RegExp; argIndex: number }[] = [
  { pattern: /\.text\(/g, argIndex: 2 },
  { pattern: /\.setText\(/g, argIndex: 0 },
  { pattern: /\blog\(/g, argIndex: 0 },
  { pattern: /\bappendLine\(/g, argIndex: 0 },
  { pattern: /\brecordAction\(/g, argIndex: 0 },
  { pattern: /\bhistory\.push\(/g, argIndex: 1 },
  { pattern: /\bstatus\(/g, argIndex: 0 },
];

/** Literals that are not player-facing text, each with the reason. A literal
 * is matched by exact content in the named file. */
const ALLOWED: { file: string; text: string; reason: string }[] = [
  { file: 'scenes/MenuScene.ts', text: 'HÉRAKLIOS', reason: 'the title is the same in every language (spec B8)' },
];

interface Violation {
  file: string;
  line: number;
  text: string;
}

/** Splits `source` from `start` (just after an opening paren) into the call's top-level arguments. */
function topLevelArgs(source: string, start: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let argStart = start;
  for (let i = start; i < source.length; i++) {
    const c = source[i]!;
    if (c === "'" || c === '"') {
      i = skipString(source, i);
    } else if (c === '`') {
      i = skipTemplate(source, i);
    } else if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (c === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2) + 1;
    } else if (c === '(' || c === '[' || c === '{') {
      depth++;
    } else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) {
        args.push(source.slice(argStart, i));
        return args;
      }
      depth--;
    } else if (c === ',' && depth === 0) {
      args.push(source.slice(argStart, i));
      argStart = i + 1;
    }
  }
  return args;
}

function skipString(source: string, i: number): number {
  const quote = source[i];
  for (let j = i + 1; j < source.length; j++) {
    if (source[j] === '\\') j++;
    else if (source[j] === quote) return j;
  }
  return source.length;
}

function skipTemplate(source: string, i: number): number {
  for (let j = i + 1; j < source.length; j++) {
    if (source[j] === '\\') j++;
    else if (source[j] === '`') return j;
    else if (source[j] === '$' && source[j + 1] === '{') j = skipBraces(source, j + 1);
  }
  return source.length;
}

function skipBraces(source: string, i: number): number {
  let depth = 0;
  for (let j = i; j < source.length; j++) {
    const c = source[j]!;
    if (c === "'" || c === '"') j = skipString(source, j);
    else if (c === '`') j = skipTemplate(source, j);
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j;
  }
  return source.length;
}

/** Every string/template literal piece in `code`, including those nested in `${}`. */
function literalPieces(code: string): string[] {
  const pieces: string[] = [];
  for (let i = 0; i < code.length; i++) {
    const c = code[i]!;
    if (c === "'" || c === '"') {
      const end = skipString(code, i);
      // A literal being compared (`mode === 'manage'`) is a value, not text.
      const compared = /(?:[!=]==?\s*)$/.test(code.slice(0, i)) || /^\s*[!=]==?/.test(code.slice(end + 1));
      if (!compared) pieces.push(code.slice(i + 1, end));
      i = end;
    } else if (c === '`') {
      const end = skipTemplate(code, i);
      const body = code.slice(i + 1, end);
      let staticText = '';
      for (let j = 0; j < body.length; j++) {
        if (body[j] === '$' && body[j + 1] === '{') {
          const close = skipBraces(body, j + 1);
          pieces.push(...literalPieces(body.slice(j + 2, close)));
          j = close;
        } else {
          staticText += body[j];
        }
      }
      pieces.push(staticText);
      i = end;
    }
  }
  return pieces;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function sourceFiles(): string[] {
  return DIRS.flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => `${dir}/${f}`),
  );
}

export function findViolations(): Violation[] {
  const found: Violation[] = [];
  for (const file of sourceFiles()) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    const check = (code: string, index: number) => {
      for (const text of literalPieces(code)) {
        if (/[A-Za-z]{2,}/.test(text)) found.push({ file, line: lineOf(source, index), text });
      }
    };
    for (const { pattern, argIndex } of CALLS) {
      for (const match of source.matchAll(pattern)) {
        const start = match.index! + match[0].length;
        const arg = topLevelArgs(source, start)[argIndex];
        if (arg !== undefined) check(arg, start);
      }
    }
    for (const match of source.matchAll(/\b(?:message|confirmLabel|cancelLabel):\s*(?=['"`])/g)) {
      const start = match.index! + match[0].length;
      const arg = topLevelArgs(source, start)[0];
      if (arg !== undefined) check(arg, start);
    }
    for (const match of source.matchAll(/\.textContent\s*=\s*([^;]*);/g)) check(match[1]!, match.index!);
  }
  return found;
}

describe('no text outside the message tables', () => {
  it('finds no literal passed to a text-showing call', () => {
    const allowed = new Set(ALLOWED.map((a) => `${a.file}: ${a.text}`));
    const unexplained = findViolations().filter((v) => !allowed.has(`${v.file}: ${v.text}`));
    expect(unexplained.map((v) => `${v.file}:${v.line} ${JSON.stringify(v.text)}`)).toEqual([]);
  });

  it('has no stale entry on the allow list', () => {
    const live = new Set(findViolations().map((v) => `${v.file}: ${v.text}`));
    const stale = ALLOWED.map((a) => `${a.file}: ${a.text}`).filter((key) => !live.has(key));
    expect(stale).toEqual([]);
  });

  it('gives every allow-list entry a reason', () => {
    for (const entry of ALLOWED) expect(entry.reason.length, entry.text).toBeGreaterThan(10);
  });
});
