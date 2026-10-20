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

/** Sites not yet moved into the tables; each later commit shrinks this. */
const PENDING: string[] = [
  "scenes/BoardScene.ts: End phase",
  "scenes/BoardScene.ts: Resolve attack",
  "scenes/BoardScene.ts: Turn",
  "scenes/BoardScene.ts: Ram!",
  "scenes/BoardScene.ts: ↶ Undo",
  "scenes/BoardScene.ts: ↷ Redo",
  "scenes/BoardScene.ts: 💾 Save / Load",
  "scenes/BoardScene.ts: ✕ Abandon game",
  "scenes/BoardScene.ts: ⚑ End game",
  "scenes/BoardScene.ts: ⏸ Pause clock",
  "scenes/BoardScene.ts: ▶ Continue",
  "scenes/BoardScene.ts: Ram ?\\n(bonus +)",
  "scenes/BoardScene.ts: Hold off",
  "scenes/BoardScene.ts: Advance into the vacated hex?",
  "scenes/BoardScene.ts:  — Advance ",
  "scenes/BoardScene.ts: Don't advance",
  "scenes/BoardScene.ts: Exchange: choose losses\\n(need ≥  attack force)",
  "scenes/BoardScene.ts: Confirm losses",
  "scenes/BoardScene.ts: Board ?\\n vs ",
  "scenes/BoardScene.ts: Board!",
  "scenes/BoardScene.ts: Cancel",
  "scenes/BoardScene.ts: ↶ Undo: ",
  "scenes/BoardScene.ts: ↷ Redo: ",
  "scenes/BoardScene.ts: Turn  —  —  phase",
  "scenes/BoardScene.ts: ⚑ Ending after this round",
  "scenes/BoardScene.ts: ▶ Resume clock",
  "scenes/BoardScene.ts: Clock:  remaining",
  "scenes/BoardScene.ts: Selected force:  / ",
  "scenes/BoardScene.ts: Game loaded.",
  "scenes/BoardScene.ts: Wait for the computer's turn to finish before saving or loading.",
  "scenes/BoardScene.ts: Resolve the pending retreat/drift before saving or loading.",
  "scenes/BoardScene.ts: Wait for the computer's turn to finish before ending the game.",
  "scenes/BoardScene.ts: Resolve the pending retreat/drift before ending the game.",
  "scenes/BoardScene.ts: The game is already ending after this round.",
  "scenes/BoardScene.ts: The game will end once every player has finished this round.",
  "scenes/BoardScene.ts: Can't undo during the computer's turn.",
  "scenes/BoardScene.ts: Resolve the pending retreat/drift before undoing.",
  "scenes/BoardScene.ts: Nothing to undo.",
  "scenes/BoardScene.ts: Undone: ",
  "scenes/BoardScene.ts: Can't redo during the computer's turn.",
  "scenes/BoardScene.ts: Resolve the pending retreat/drift before redoing.",
  "scenes/BoardScene.ts: Nothing to redo.",
  "scenes/BoardScene.ts: Redone: ",
  "scenes/BoardScene.ts:  charges!",
  "scenes/BoardScene.ts: No movement left to rotate.",
  "scenes/BoardScene.ts: Ramming:  vs , bonus + ",
  "scenes/BoardScene.ts: ( unused movement )\\n",
  "scenes/BoardScene.ts: Succeeds on:    ()\\n",
  "scenes/BoardScene.ts: SUNK!",
  "scenes/BoardScene.ts: missed",
  "scenes/BoardScene.ts: Die:  -> ",
  "scenes/BoardScene.ts:  has already attacked this phase.",
  "scenes/BoardScene.ts:  already rammed this turn and can't also board.",
  "scenes/BoardScene.ts:  can't reach the current target(s).",
  "scenes/BoardScene.ts:  has no eligible target in common with the current group.",
  "scenes/BoardScene.ts: Removed from the combat (nothing left in range): .",
  "scenes/BoardScene.ts:  has already been attacked this phase.",
  "scenes/BoardScene.ts:  isn't adjacent with a parallel facing — not a legal boarding target.",
  "scenes/BoardScene.ts: Single-defender mode: only one target per attack — resolve or deselect it first.",
  "scenes/BoardScene.ts:  can't be attacked by cavalry — remove the cavalry from the group first.",
  "scenes/BoardScene.ts:  isn't reachable by the current attack group.",
  "scenes/BoardScene.ts:  advances into the vacated hex.",
  "scenes/BoardScene.ts: Resolve the pending retreat/drift before starting a new attack.",
  "scenes/BoardScene.ts: Select at least one attacking unit first.",
  "scenes/BoardScene.ts: Naval attacks resolve immediately when you pick a target.",
  "scenes/BoardScene.ts: Select at least one target.",
  "scenes/BoardScene.ts: none",
  "scenes/BoardScene.ts: Exchange: defender(s) destroyed; sacrificed .",
  "scenes/BoardScene.ts: Select units totaling at least  attack force before confirming.",
  "scenes/BoardScene.ts: Boarding:  (attack ) vs  (defense )",
  "scenes/BoardScene.ts: CRT column: \"\" (column  of , array index )",
  "scenes/BoardScene.ts:    (attacker): / -> / equipment (attack  -> )",
  "scenes/BoardScene.ts:    (defender): / -> / equipment (defense  -> )",
  "scenes/BoardScene.ts: Wait for the computer's turn to finish before ending the phase.",
  "scenes/BoardScene.ts: Resolve the pending retreat/drift before ending the phase.",
  "scenes/BoardScene.ts: The computer player hit an error and stopped. See the console.",
  "scenes/BoardScene.ts: :  moves to (, ).",
  "scenes/BoardScene.ts: :  turns.",
  "scenes/BoardScene.ts:  tramples into  at (, ).",
  "scenes/BoardScene.ts:  retreats.",
  "scenes/BoardScene.ts:  retreats, making room for .",
  "scenes/BoardScene.ts:  had nowhere to retreat and was eliminated.",
  "scenes/BoardScene.ts:  must retreat to make room — click a highlighted hex.",
  "scenes/BoardScene.ts:  must retreat — click a highlighted hex.",
  "scenes/BoardScene.ts:  has nowhere to retreat —  make room. Click one to push it.",
  "scenes/BoardScene.ts: Move ",
  "scenes/BoardScene.ts: Turn ",
  "scenes/BoardScene.ts: Move  into contact",
  "scenes/BoardScene.ts: Ram ",
  "scenes/BoardScene.ts: Deselect ",
  "scenes/BoardScene.ts: Select ",
  "scenes/BoardScene.ts: Untarget ",
  "scenes/BoardScene.ts: Target ",
  "scenes/BoardScene.ts: Attack with  unit(s)",
  "scenes/BoardScene.ts: Board ",
  "scenes/BoardScene.ts: Abandon this game and return to the menu?\\nProgress since your last save will be lost.",
  "scenes/BoardScene.ts: Abandon",
  "scenes/BoardScene.ts: Keep playing",
  "scenes/BoardScene.ts: End the game now?\\nEvery player still finishes their current round — the highest remaining army value wins, and a tie is a draw.",
  "scenes/BoardScene.ts: End game",
  "ui/confirmDialog.ts: BoardScene",
  "ui/confirmDialog.ts: PlacementScene",
  "ui/confirmDialog.ts: MapView",
  "ui/confirmDialog.ts: s\r\n   * `pinUIObjects`/`excludeFromMainCamera` — pass that hook through here so\r\n   * this dialog gets the same treatment and isn",
  "ui/confirmDialog.ts: s pan\r\n   * or zoom. Scenes with no such camera (`ArmyBuilderScene`) omit it.\r\n   */\r\n  excludeFromMainCamera?: (objects: Phaser.GameObjects.GameObject[]) => void;\r\n",
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
    for (const match of source.matchAll(/\b(?:message|confirmLabel|cancelLabel):\s*/g)) {
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
    const pending = new Set(PENDING);
    const unexplained = findViolations().filter((v) => {
      const key = `${v.file}: ${v.text}`;
      return !allowed.has(key) && !pending.has(key);
    });
    expect(unexplained.map((v) => `${v.file}:${v.line} ${JSON.stringify(v.text)}`)).toEqual([]);
  });

  it('has no stale entry on the allow or pending list', () => {
    const live = new Set(findViolations().map((v) => `${v.file}: ${v.text}`));
    const stale = [...ALLOWED.map((a) => `${a.file}: ${a.text}`), ...PENDING].filter((key) => !live.has(key));
    expect(stale).toEqual([]);
  });

  it('gives every allow-list entry a reason', () => {
    for (const entry of ALLOWED) expect(entry.reason.length, entry.text).toBeGreaterThan(10);
  });
});
