/**
 * The Board's message history (§49): every message the Board logs is kept as
 * an entry, with a "Turn N — <player>" heading whenever the turn or the
 * active player changes, and the layout / scroll arithmetic the log panel
 * (`logPanel.ts`) draws from. Pure: no Phaser, no i18n, no `GameState` — the
 * scene hands it the heading text and a key, and a `wrap` function.
 */

export type LogKind = 'heading' | 'entry';

export interface LogItem {
  kind: LogKind;
  text: string;
}

/** The heading context the scene builds: `key` identifies (turn, player). */
export interface LogContext {
  key: string;
  heading: string;
}

export class LogHistory {
  private items: LogItem[] = [];
  private lastKey: string | null = null;

  /** Adds an entry (after a heading if `ctx.key` changed). Blank text adds
   * nothing (a phase change's `log('')` once cleared the panel; with a
   * history there is nothing to clear). Returns the entry's index, or -1. */
  add(text: string, ctx: LogContext): number {
    if (text.trim() === '') return -1;
    if (ctx.key !== this.lastKey) {
      this.items.push({ kind: 'heading', text: ctx.heading });
      this.lastKey = ctx.key;
    }
    this.items.push({ kind: 'entry', text });
    return this.items.length - 1;
  }

  /** Replaces the text of the entry at `index` (a drift's growing entry). */
  update(index: number, text: string): void {
    const item = this.items[index];
    if (item && item.kind === 'entry') item.text = text;
  }

  clear(): void {
    this.items = [];
    this.lastKey = null;
  }

  entries(): readonly LogItem[] {
    return this.items;
  }

  /** Index of the newest entry (not heading), or -1 when there is none. */
  newest(): number {
    for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i]!.kind === 'entry') return i;
    return -1;
  }
}

/** One display line of the laid-out history. */
export interface DisplayLine {
  kind: LogKind;
  text: string;
  /** True for every line of the newest entry (B7). */
  newest: boolean;
}

/** Wraps one message into display lines. */
export type WrapFn = (text: string) => string[];

/**
 * Lays entries out as display lines. A wrapped entry is cached by index and
 * text, so one new entry wraps one entry and an updated (drift) entry wraps
 * again.
 */
export class LineLayout {
  private cache = new Map<number, { text: string; lines: string[] }>();

  constructor(private readonly wrap: WrapFn) {}

  layout(entries: readonly LogItem[], newest: number): DisplayLine[] {
    const out: DisplayLine[] = [];
    entries.forEach((item, i) => {
      let hit = this.cache.get(i);
      if (!hit || hit.text !== item.text) {
        hit = { text: item.text, lines: this.wrap(item.text) };
        this.cache.set(i, hit);
      }
      for (const text of hit.lines) out.push({ kind: item.kind, text, newest: i === newest });
    });
    return out;
  }
}

export const LINE_HEIGHT = 17;
export const LOG_TOP = 178;
/** The drift Continue button sits at `height − 232`; stay 8 px above it. */
export const LOG_BOTTOM_MARGIN = 240;

export interface LogBounds {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

export function logPanelBounds(height: number, panelWidth: number): LogBounds {
  return { left: 16, top: LOG_TOP, width: panelWidth - 32, bottom: height - LOG_BOTTOM_MARGIN };
}

export function visibleLineCount(bounds: LogBounds, lineHeight: number): number {
  return Math.max(0, Math.floor((bounds.bottom - bounds.top) / lineHeight));
}

function maxOffset(total: number, visible: number): number {
  return Math.max(0, total - visible);
}

export function clampOffset(offset: number, total: number, visible: number): number {
  return Math.min(Math.max(0, offset), maxOffset(total, visible));
}

export function isAtBottom(offset: number, total: number, visible: number): boolean {
  return offset >= maxOffset(total, visible);
}

/** The offset after the content changed size: to the new bottom only if the
 * view was at the bottom before; otherwise unchanged (B6). */
export function follow(prevOffset: number, prevTotal: number, newTotal: number, visible: number): number {
  if (isAtBottom(prevOffset, prevTotal, visible)) return maxOffset(newTotal, visible);
  return clampOffset(prevOffset, newTotal, visible);
}

export interface Thumb {
  /** Top of the thumb inside the track, and its height. */
  top: number;
  size: number;
}

/** The scrollbar thumb, or null when everything fits. */
export function thumb(
  total: number,
  visible: number,
  offset: number,
  trackHeight: number,
  minThumb: number,
): Thumb | null {
  if (total <= visible || visible <= 0) return null;
  const size = Math.min(trackHeight, Math.max(minThumb, (visible / total) * trackHeight));
  const max = maxOffset(total, visible);
  const top = (clampOffset(offset, total, visible) / max) * (trackHeight - size);
  return { top, size };
}

/** The offset for a thumb dragged to `thumbTop` (inverse of `thumb`). */
export function offsetForThumb(
  thumbTop: number,
  total: number,
  visible: number,
  trackHeight: number,
  minThumb: number,
): number {
  const t = thumb(total, visible, 0, trackHeight, minThumb);
  if (!t) return 0;
  const room = trackHeight - t.size;
  if (room <= 0) return 0;
  const frac = Math.min(1, Math.max(0, thumbTop / room));
  return clampOffset(Math.round(frac * maxOffset(total, visible)), total, visible);
}
