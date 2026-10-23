import { describe, expect, it, vi } from 'vitest';
import {
  LINE_HEIGHT,
  LineLayout,
  LogHistory,
  clampOffset,
  follow,
  logPanelBounds,
  offsetForThumb,
  thumb,
  visibleLineCount,
} from './logHistory';

const ctx = (key: string) => ({ key, heading: `H ${key}` });
const texts = (h: LogHistory) => h.entries().map((e) => `${e.kind}:${e.text}`);

describe('LogHistory', () => {
  it('H1: one heading, then entries in order', () => {
    const h = new LogHistory();
    h.add('a', ctx('1:0'));
    h.add('b', ctx('1:0'));
    h.add('c', ctx('1:0'));
    expect(texts(h)).toEqual(['heading:H 1:0', 'entry:a', 'entry:b', 'entry:c']);
  });

  it('H2: a change of turn or of player adds a heading; a return adds one again', () => {
    const h = new LogHistory();
    h.add('a', ctx('1:0'));
    h.add('b', ctx('1:1'));
    h.add('c', ctx('2:1'));
    h.add('d', ctx('1:0'));
    expect(texts(h)).toEqual([
      'heading:H 1:0',
      'entry:a',
      'heading:H 1:1',
      'entry:b',
      'heading:H 2:1',
      'entry:c',
      'heading:H 1:0',
      'entry:d',
    ]);
  });

  it('H3: update replaces the entry, never appends', () => {
    const h = new LogHistory();
    const i = h.add('a', ctx('1:0'));
    h.update(i, 'a b');
    h.update(i, 'a b c');
    expect(texts(h)).toEqual(['heading:H 1:0', 'entry:a b c']);
  });

  it('H4: update changes the given entry, not the last one', () => {
    const h = new LogHistory();
    const i = h.add('drift', ctx('1:0'));
    h.add('other', ctx('1:0'));
    h.update(i, 'drift more');
    expect(texts(h)).toEqual(['heading:H 1:0', 'entry:drift more', 'entry:other']);
  });

  it('H5: blank text adds neither entry nor heading', () => {
    const h = new LogHistory();
    expect(h.add('', ctx('1:0'))).toBe(-1);
    expect(h.add('  \n ', ctx('1:0'))).toBe(-1);
    expect(h.entries()).toHaveLength(0);
  });

  it('H6: clear empties it and the next add gets a heading again', () => {
    const h = new LogHistory();
    h.add('a', ctx('1:0'));
    h.clear();
    expect(h.entries()).toHaveLength(0);
    h.add('b', ctx('1:0'));
    expect(texts(h)).toEqual(['heading:H 1:0', 'entry:b']);
  });
});

describe('LineLayout', () => {
  const wrap = (t: string) => t.split('|');

  it('H7: only the newest entry is flagged; headings are headings', () => {
    const h = new LogHistory();
    h.add('a|a2', ctx('1:0'));
    h.add('b|b2', ctx('1:0'));
    const lines = new LineLayout(wrap).layout(h.entries(), h.newest());
    expect(lines.map((l) => `${l.kind}:${l.text}:${l.newest}`)).toEqual([
      'heading:H 1:0:false',
      'entry:a:false',
      'entry:a2:false',
      'entry:b:true',
      'entry:b2:true',
    ]);
  });

  it('H8: wraps an unchanged entry once, and again after update', () => {
    const spy = vi.fn(wrap);
    const layout = new LineLayout(spy);
    const h = new LogHistory();
    const i = h.add('a', ctx('1:0'));
    layout.layout(h.entries(), h.newest());
    const calls = spy.mock.calls.length;
    layout.layout(h.entries(), h.newest());
    expect(spy.mock.calls.length).toBe(calls);
    h.update(i, 'a|more');
    const lines = layout.layout(h.entries(), h.newest());
    expect(spy.mock.calls.length).toBe(calls + 1);
    expect(lines.map((l) => l.text)).toContain('more');
  });
});

describe('scroll arithmetic', () => {
  it('S1: clampOffset stays in [0, max(0, total - visible)]', () => {
    expect(clampOffset(-3, 20, 5)).toBe(0);
    expect(clampOffset(8, 20, 5)).toBe(8);
    expect(clampOffset(99, 20, 5)).toBe(15);
    expect(clampOffset(4, 3, 5)).toBe(0);
  });

  it('S2: follow moves to the bottom only from the bottom', () => {
    expect(follow(15, 20, 23, 5)).toBe(18);
    expect(follow(10, 20, 23, 5)).toBe(10);
    expect(follow(18, 23, 24, 5)).toBe(19);
  });

  it('S3: thumb size and position, and its inverse', () => {
    expect(thumb(5, 5, 0, 100, 10)).toBeNull();
    expect(thumb(20, 5, 0, 100, 10)).toEqual({ top: 0, size: 25 });
    expect(thumb(20, 5, 15, 100, 10)).toEqual({ top: 75, size: 25 });
    expect(thumb(20, 5, 5, 100, 10)).toEqual({ top: 25, size: 25 });
    expect(thumb(1000, 5, 0, 100, 10)?.size).toBe(10);
    for (const off of [0, 3, 7, 15]) {
      const t = thumb(20, 5, off, 100, 10)!;
      expect(offsetForThumb(t.top, 20, 5, 100, 10)).toBe(off);
    }
    expect(offsetForThumb(-50, 20, 5, 100, 10)).toBe(0);
    expect(offsetForThumb(500, 20, 5, 100, 10)).toBe(15);
  });
});

describe('layout rule', () => {
  it('L1: at 1100x750 the panel clears the bottom-left buttons and whole lines fit', () => {
    const b = logPanelBounds(750, 300);
    expect(b.top).toBe(178);
    expect(b.bottom).toBe(510);
    expect(b.bottom).toBeLessThanOrEqual(750 - 232);
    expect(b.top + visibleLineCount(b, LINE_HEIGHT) * LINE_HEIGHT).toBeLessThanOrEqual(b.bottom);
    expect(b.width).toBe(268);
  });
});
