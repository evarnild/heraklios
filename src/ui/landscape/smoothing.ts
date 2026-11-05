import type { Point } from './geometry';

function cut(a: Point, b: Point): [Point, Point] {
  return [
    { x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y },
    { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y },
  ];
}

/** Chaikin corner cutting of a closed loop: each edge `p -> q` becomes the
 * points at 1/4 and 3/4 along it. The point count doubles per iteration. */
export function smoothLoop(points: readonly Point[], iterations = 2): Point[] {
  let current = [...points];
  for (let n = 0; n < iterations && current.length > 2; n++) {
    const out: Point[] = [];
    for (let i = 0; i < current.length; i++) out.push(...cut(current[i]!, current[(i + 1) % current.length]!));
    current = out;
  }
  return current;
}

/** Chaikin on an open polyline; the two end points stay where they are. */
export function smoothPolyline(points: readonly Point[], iterations = 2): Point[] {
  let current = [...points];
  for (let n = 0; n < iterations && current.length > 2; n++) {
    const out: Point[] = [current[0]!];
    for (let i = 0; i < current.length - 1; i++) {
      const [q, r] = cut(current[i]!, current[i + 1]!);
      if (i > 0) out.push(q);
      if (i < current.length - 2) out.push(r);
    }
    out.push(current[current.length - 1]!);
    current = out;
  }
  return current;
}
