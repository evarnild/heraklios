import { describe, expect, it } from 'vitest';
import { RIVER_HEXSIDES } from '../../data/map';
import { hexVertex, vertexKey } from './geometry';
import { MEANDER_MAX, hexsideSegment, meander, riverPolylines } from './rivers';

const parse = (k: string) => k.split('|').map((s) => s.split(',').map(Number) as [number, number]);
const cornerKeys = (q: number, r: number) => [0, 1, 2, 3, 4, 5].map((i) => vertexKey(hexVertex({ q, r }, i)));

describe('hexsideSegment', () => {
  it('runs between the two vertices both hexes share', () => {
    for (const key of RIVER_HEXSIDES) {
      const [[aq, ar], [bq, br]] = parse(key) as [[number, number], [number, number]];
      const vb = new Set(cornerKeys(bq, br));
      const shared = cornerKeys(aq, ar)
        .filter((k) => vb.has(k))
        .sort();
      const seg = hexsideSegment(key);
      expect([vertexKey(seg.a), vertexKey(seg.b)].sort(), key).toEqual(shared);
      expect(shared).toHaveLength(2);
    }
  });

  it('rejects hexes that are not adjacent', () => {
    expect(() => hexsideSegment('0,0|5,5')).toThrow();
  });
});

describe('riverPolylines', () => {
  it('covers every RIVER_HEXSIDES key by exactly one segment', () => {
    const lines = riverPolylines(RIVER_HEXSIDES);
    const keys = lines.flatMap((l) => l.keys);
    expect(keys).toHaveLength(RIVER_HEXSIDES.size);
    expect(new Set(keys)).toEqual(RIVER_HEXSIDES);
    for (const l of lines) expect(l.points).toHaveLength(l.keys.length + 1);
  });

  it('joins consecutive segments end to end', () => {
    for (const l of riverPolylines(RIVER_HEXSIDES)) {
      l.keys.forEach((key, i) => {
        const seg = hexsideSegment(key);
        const ends = [vertexKey(seg.a), vertexKey(seg.b)].sort();
        expect([vertexKey(l.points[i]!), vertexKey(l.points[i + 1]!)].sort()).toEqual(ends);
      });
    }
  });

  it('chains two hexsides that meet at a vertex into one polyline', () => {
    const lines = riverPolylines(['0,0|1,0', '0,0|1,-1']);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.keys).toHaveLength(2);
    expect(lines[0]!.points).toHaveLength(3);
  });

  it('ends polylines at a fork', () => {
    const lines = riverPolylines(['0,0|1,0', '0,0|1,-1', '1,-1|1,0']);
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l.keys).toHaveLength(1);
  });

  it('closes a ring of hexsides around a hex into one polyline', () => {
    const ring = ['0,0|1,0', '0,0|1,-1', '0,-1|0,0', '-1,0|0,0', '-1,1|0,0', '0,0|0,1'];
    const lines = riverPolylines(ring);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.keys).toHaveLength(6);
    expect(vertexKey(lines[0]!.points[0]!)).toBe(vertexKey(lines[0]!.points[6]!));
  });
});

describe('meander', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 17 },
  ];

  it('is deterministic and keeps the original points', () => {
    expect(meander(line)).toEqual(meander(line));
    const out = meander(line);
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual(line[0]);
    expect(out[2]).toEqual(line[1]);
    expect(out[4]).toEqual(line[2]);
  });

  it('offsets midpoints sideways by at most the amplitude', () => {
    const out = meander(line, 100);
    const mid = out[1]!;
    expect(mid.x).toBeCloseTo(10, 6);
    expect(Math.abs(mid.y)).toBeLessThanOrEqual(MEANDER_MAX + 1e-9);
    const mid2 = out[3]!;
    const dist = Math.abs((mid2.x - 25) * 17 - (mid2.y - 8.5) * 10) / Math.hypot(10, 17);
    expect(dist).toBeLessThanOrEqual(MEANDER_MAX + 1e-9);
    expect(meander(line, 0)[1]).toEqual({ x: 10, y: 0 });
  });
});
