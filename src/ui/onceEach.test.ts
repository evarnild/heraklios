import { describe, expect, it, vi } from 'vitest';
import { onceEach } from './onceEach';

describe('onceEach', () => {
  it('runs once for the same event object seen twice', () => {
    const fn = vi.fn();
    const h = onceEach(fn);
    const e = { key: 'z' };
    h(e);
    h(e);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs for each distinct object, even with equal fields', () => {
    const fn = vi.fn();
    const h = onceEach(fn);
    h({ key: 'z' });
    h({ key: 'z' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('runs twice for interleaved A, B, A, B', () => {
    const fn = vi.fn();
    const h = onceEach(fn);
    const a = { key: 'a' };
    const b = { key: 'b' };
    h(a);
    h(b);
    h(a);
    h(b);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('passes the event through', () => {
    const fn = vi.fn();
    const e = { key: 'y' };
    onceEach(fn)(e);
    expect(fn).toHaveBeenCalledWith(e);
  });
});
