import type { HexCoord } from '../data/map';
import { hexPolygonPoints, TERRAIN_COLORS, RIVER_COLOR } from '../ui/hexRender';
import type { EditorState } from './editorState';
import { Camera } from './camera';

export type Hover = { kind: 'hex'; hex: HexCoord } | { kind: 'edge'; a: HexCoord; b: HexCoord } | null;

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  camera: Camera,
  viewportW: number,
  viewportH: number,
  hover: Hover,
  riverMode: boolean,
): void {
  ctx.save();
  ctx.clearRect(0, 0, viewportW, viewportH);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, viewportW, viewportH);

  const zoomedHexSize = 22 * camera.zoom;
  // Cull hexes clearly outside the viewport for performance on large grids.
  const margin = zoomedHexSize * 2;

  for (const hex of state.allHexes()) {
    const center = camera.hexToScreen(hex, viewportW, viewportH);
    if (
      center.x < -margin ||
      center.x > viewportW + margin ||
      center.y < -margin ||
      center.y > viewportH + margin
    ) {
      continue;
    }
    const terrain = state.getTerrain(hex)!;
    const points = scaledHexPoints(center, camera.zoom);
    ctx.beginPath();
    tracePoly(ctx, points);
    ctx.fillStyle = colorToCss(TERRAIN_COLORS[terrain] ?? 0xff00ff);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // rivers
  ctx.strokeStyle = colorToCss(RIVER_COLOR);
  ctx.lineWidth = Math.max(2, 4 * camera.zoom);
  for (const [a, b] of state.riverEdgeList()) {
    const A = camera.hexToScreen(a, viewportW, viewportH);
    const B = camera.hexToScreen(b, viewportW, viewportH);
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    let px = -(B.y - A.y);
    let py = B.x - A.x;
    const len = Math.hypot(px, py) || 1;
    const half = (22 * camera.zoom) / 2;
    px = (px / len) * half;
    py = (py / len) * half;
    ctx.beginPath();
    ctx.moveTo(mx - px, my - py);
    ctx.lineTo(mx + px, my + py);
    ctx.stroke();
  }

  // hover highlight
  if (hover?.kind === 'hex') {
    const center = camera.hexToScreen(hover.hex, viewportW, viewportH);
    const points = scaledHexPoints(center, camera.zoom);
    ctx.beginPath();
    tracePoly(ctx, points);
    ctx.strokeStyle = riverMode ? 'rgba(120,120,120,0.5)' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (hover?.kind === 'edge') {
    const A = camera.hexToScreen(hover.a, viewportW, viewportH);
    const B = camera.hexToScreen(hover.b, viewportW, viewportH);
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    let px = -(B.y - A.y);
    let py = B.x - A.x;
    const len = Math.hypot(px, py) || 1;
    const half = (22 * camera.zoom) / 2;
    px = (px / len) * half;
    py = (py / len) * half;
    ctx.beginPath();
    ctx.moveTo(mx - px, my - py);
    ctx.lineTo(mx + px, my + py);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  ctx.restore();
}

function scaledHexPoints(center: { x: number; y: number }, zoom: number): number[] {
  // hexPolygonPoints uses the fixed HEX_SIZE constant; scale around the center.
  const base = hexPolygonPoints({ x: 0, y: 0 });
  const scaled: number[] = [];
  for (let i = 0; i < base.length; i += 2) {
    scaled.push(center.x + base[i]! * zoom, center.y + base[i + 1]! * zoom);
  }
  return scaled;
}

function tracePoly(ctx: CanvasRenderingContext2D, points: number[]): void {
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i]!, points[i + 1]!);
  }
  ctx.closePath();
}
