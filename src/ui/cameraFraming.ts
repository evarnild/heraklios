/**
 * §83: the map camera's zoom limits and the pure math that frames a world
 * box in the viewport with the least camera change. No Phaser import.
 */
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.5;
/** Screen pixels kept clear on every side of the viewport when framing. */
export const FRAME_MARGIN = 24;

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CameraFrame {
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** The bounding box of world points, grown by `grow` on every side. */
export function boxAround(points: Array<{ x: number; y: number }>, grow: number): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    left: Math.min(...xs) - grow,
    top: Math.min(...ys) - grow,
    right: Math.max(...xs) + grow,
    bottom: Math.max(...ys) + grow,
  };
}

/**
 * I3: "just enough to frame" is the LEAST camera change. In order: leave the
 * camera alone if the box already lies in the usable view (the viewport less
 * `FRAME_MARGIN` on each side); else pan to the box centre at the current
 * zoom if the box fits; else zoom out to the largest zoom at which it fits,
 * not below `MIN_ZOOM` (then the box overflows, centred). It never zooms in.
 */
export function frameBox(box: Box, current: CameraFrame, viewport: Viewport): CameraFrame {
  const usableW = viewport.width - 2 * FRAME_MARGIN;
  const usableH = viewport.height - 2 * FRAME_MARGIN;
  const boxW = box.right - box.left;
  const boxH = box.bottom - box.top;
  const halfW = usableW / current.zoom / 2;
  const halfH = usableH / current.zoom / 2;
  const inside =
    box.left >= current.centerX - halfW &&
    box.right <= current.centerX + halfW &&
    box.top >= current.centerY - halfH &&
    box.bottom <= current.centerY + halfH;
  if (inside) return current;
  const centerX = (box.left + box.right) / 2;
  const centerY = (box.top + box.bottom) / 2;
  if (boxW <= usableW / current.zoom && boxH <= usableH / current.zoom) {
    return { zoom: current.zoom, centerX, centerY };
  }
  const fit = Math.min(usableW / boxW, usableH / boxH);
  return { zoom: Math.max(MIN_ZOOM, Math.min(fit, current.zoom)), centerX, centerY };
}
