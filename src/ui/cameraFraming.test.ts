import { describe, it, expect } from 'vitest';
import { FRAME_MARGIN, MIN_ZOOM, MAX_ZOOM, boxAround, frameBox } from './cameraFraming';

const VIEW = { width: 800, height: 750 };
const at = (zoom: number, centerX = 0, centerY = 0) => ({ zoom, centerX, centerY });
const box = (cx: number, cy: number, w: number, h: number) => ({
  left: cx - w / 2,
  right: cx + w / 2,
  top: cy - h / 2,
  bottom: cy + h / 2,
});

describe('limits', () => {
  it('are the wheel limits', () => {
    expect([MIN_ZOOM, MAX_ZOOM, FRAME_MARGIN]).toEqual([0.4, 2.5, 24]);
  });
});

describe('boxAround', () => {
  it('grows the bounding box by exactly grow on every side', () => {
    expect(boxAround([{ x: 10, y: 20 }, { x: 40, y: 5 }], 3)).toEqual({ left: 7, right: 43, top: 2, bottom: 23 });
  });
});

describe('frameBox', () => {
  it('leaves the camera when the box is already in the usable view', () => {
    const cur = at(1);
    expect(frameBox(box(10, 10, 200, 200), cur, VIEW)).toBe(cur);
  });

  it('treats a box 1 px inside the margin as visible and 1 px over as not', () => {
    const half = (800 - 2 * FRAME_MARGIN) / 2; // 376 at zoom 1, centre 0
    expect(frameBox({ left: -half, right: half, top: -50, bottom: 50 }, at(1), VIEW)).toEqual(at(1));
    const over = frameBox({ left: -half, right: half + 1, top: -50, bottom: 50 }, at(1), VIEW);
    expect(over.centerX).toBe(0.5);
    expect(over.zoom).toBeLessThan(1);
  });

  it('pans, keeping the zoom, when an off-centre box fits', () => {
    expect(frameBox(box(1000, 500, 200, 100), at(1), VIEW)).toEqual(at(1, 1000, 500));
  });

  it('zooms out to the exact width fit for a wide box', () => {
    const r = frameBox(box(1000, 500, 1000, 100), at(1), VIEW);
    expect(r.zoom).toBe((800 - 48) / 1000);
    expect([r.centerX, r.centerY]).toEqual([1000, 500]);
  });

  it('zooms out to the exact height fit for a tall box', () => {
    const r = frameBox(box(0, 1000, 100, 1200), at(1), VIEW);
    expect(r.zoom).toBe((750 - 48) / 1200);
  });

  it('never zooms in', () => {
    const r = frameBox(box(2000, 2000, 50, 50), at(0.6), VIEW);
    expect(r).toEqual(at(0.6, 2000, 2000));
  });

  it('floors at MIN_ZOOM and centres on the box', () => {
    const r = frameBox(box(500, 300, 5000, 5000), at(1), VIEW);
    expect(r).toEqual(at(MIN_ZOOM, 500, 300));
  });
});
