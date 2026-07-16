import type { HexCoord } from '../data/map';
import type { TerrainType } from '../data/terrain';
import type { EditorState } from './editorState';
import { Camera, nearestNeighbor } from './camera';
import { pixelToHexRound } from '../ui/hexRender';
import type { Hover } from './render';

export interface EditorTools {
  getActiveTerrain(): TerrainType;
  isRiverMode(): boolean;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

/** Wires mouse interaction onto the canvas: left-click/drag paints hexes (or
 * toggles the nearest river hexside in river mode), right-drag pans, wheel
 * zooms toward the cursor. Returns a hover accessor for the render loop. */
export function attachInput(
  canvas: HTMLCanvasElement,
  state: EditorState,
  camera: Camera,
  tools: EditorTools,
  onChange: () => void,
): { getHover: () => Hover } {
  let hover: Hover = null;
  let painting = false;
  let panning = false;
  let lastScreen = { x: 0, y: 0 };
  let lastPaintedKey: string | null = null;

  function viewport(): { w: number; h: number } {
    return { w: canvas.clientWidth, h: canvas.clientHeight };
  }

  function screenFromEvent(e: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hexAt(screen: { x: number; y: number }): HexCoord {
    const { w, h } = viewport();
    const world = camera.screenToWorld(screen.x, screen.y, w, h);
    return pixelToHexRound(world.x, world.y);
  }

  function updateHover(screen: { x: number; y: number }): void {
    const { w, h } = viewport();
    const world = camera.screenToWorld(screen.x, screen.y, w, h);
    const hex = pixelToHexRound(world.x, world.y);
    if (!state.hasHex(hex)) {
      hover = null;
      return;
    }
    if (tools.isRiverMode()) {
      const neighbor = nearestNeighbor(hex, world);
      hover = state.hasHex(neighbor) ? { kind: 'edge', a: hex, b: neighbor } : { kind: 'hex', hex };
    } else {
      hover = { kind: 'hex', hex };
    }
  }

  function paintAt(screen: { x: number; y: number }, isNewStroke: boolean): void {
    const hex = hexAt(screen);
    if (!state.hasHex(hex)) return;

    if (tools.isRiverMode()) {
      const { w, h } = viewport();
      const world = camera.screenToWorld(screen.x, screen.y, w, h);
      const neighbor = nearestNeighbor(hex, world);
      if (!state.hasHex(neighbor)) return;
      const key = [hex.q, hex.r, neighbor.q, neighbor.r].sort().join(',');
      if (!isNewStroke && key === lastPaintedKey) return; // don't re-toggle while dragging over the same edge
      lastPaintedKey = key;
      state.toggleRiver(hex, neighbor);
    } else {
      const key = `${hex.q},${hex.r}`;
      if (!isNewStroke && key === lastPaintedKey) return;
      lastPaintedKey = key;
      state.setTerrain(hex, tools.getActiveTerrain());
    }
    onChange();
  }

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    const screen = screenFromEvent(e);
    if (e.button === 2) {
      panning = true;
      lastScreen = screen;
      return;
    }
    if (e.button === 0) {
      painting = true;
      lastPaintedKey = null;
      paintAt(screen, true);
    }
  });

  window.addEventListener('mouseup', () => {
    painting = false;
    panning = false;
    lastPaintedKey = null;
  });

  canvas.addEventListener('mousemove', (e) => {
    const screen = screenFromEvent(e);
    if (panning) {
      camera.x -= (screen.x - lastScreen.x) / camera.zoom;
      camera.y -= (screen.y - lastScreen.y) / camera.zoom;
      lastScreen = screen;
      onChange();
      return;
    }
    updateHover(screen);
    if (painting) {
      paintAt(screen, false);
    } else {
      onChange();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hover = null;
    onChange();
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const screen = screenFromEvent(e);
      const { w, h } = viewport();
      const before = camera.screenToWorld(screen.x, screen.y, w, h);
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
      const after = camera.screenToWorld(screen.x, screen.y, w, h);
      camera.x -= after.x - before.x;
      camera.y -= after.y - before.y;
      onChange();
    },
    { passive: false },
  );

  return { getHover: () => hover };
}
