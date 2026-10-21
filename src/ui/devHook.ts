/**
 * Dev-only test hook for the browser smoke suite (`npm run e2e`,
 * intents/32-e2e-smoke-suite spec B4). Installed from `main.ts` only under
 * `import.meta.env.DEV`, so a production build never contains it — which
 * `e2e/global-setup.ts` checks before every run.
 *
 * The canvas has no DOM to query, so a browser test reads the game and finds
 * what to click through `window.__heraklios`. It never changes game state;
 * `seed` only swaps `Math.random` so dice are reproducible.
 */
import Phaser from 'phaser';
import { createSeededRng } from '../engine/rng';
import { reachableHexes } from '../engine/movement';
import { pickButton, matchingButtons, type ButtonCandidate } from './devHookMatch';
import { session } from './session';

type Hex = { q: number; r: number };
type Point = { x: number; y: number };

/**
 * `BoardScene`'s "busy" fields, read by name (spec Interpretations: no
 * public method added to the scene). `idle()` throws if one disappears, so a
 * rename breaks the suite loudly instead of making `idle()` always true.
 */
const BUSY_FIELDS = ['aiRunning', 'decisionPending', 'retreatChoice', 'driftState'] as const;

interface BoardInternals extends Phaser.Scene {
  mapView: { toScreen(h: Hex): Point };
}

export interface DevHook {
  scenes(): string[];
  state(): unknown;
  testScenario(): string | null;
  seed(n: number): void;
  reachable(unitId: string): string[];
  centerOn(hex: Hex): void;
  hexToCanvas(hex: Hex): Point | null;
  buttonCount(label: string): number;
  buttonToCanvas(label: string, index?: number): Point;
  /** What is pending on the board — empty when a human could act. */
  busy(): string[];
  idle(): boolean;
  /**
   * The hexes a pending retreat or push-target choice highlights (empty if
   * none). A test answers the prompt by clicking one, as a player would, so
   * a scenario never depends on whether the roll caused a retreat.
   */
  pendingHexes(): Hex[];
  /**
   * While the Placement scene is up: the unit type it is placing now (null
   * once the queue is empty) and the hexes it accepts a click on for it.
   * Read-only; a scenario clicks one, as a player would (�40).
   */
  placement(): { current: string | null; legalHexes: Hex[] };
}

/** `PlacementScene` members `placement()` reads, by name; guarded like `BUSY_FIELDS`. */
const PLACEMENT_MEMBERS = ['queue', 'currentLegalHexes'] as const;

interface PlacementInternals {
  queue: { typeId: string; remaining: number }[];
  currentLegalHexes(): Hex[];
}

/** The shape of `BoardScene.retreatChoice` this hook reads. */
interface PendingChoice {
  kind: 'retreat' | 'choosePushTarget';
  legalHexes?: Hex[];
  pushTargets?: { position: Hex }[];
}

export function installDevHook(game: Phaser.Game): void {
  const board = (): BoardInternals => {
    if (!game.scene.isActive('Board')) throw new Error('Board scene is not active');
    return game.scene.getScene('Board') as BoardInternals;
  };

  /** The Board or the Placement scene: either draws the map through a `mapView`. */
  const mapScene = (): BoardInternals => {
    const scene = game.scene.getScenes(true).find((sc) => 'mapView' in sc);
    if (!scene) throw new Error('No active scene with a map');
    return scene as BoardInternals;
  };

  const buttons = (): ButtonCandidate[] =>
    game.scene.getScenes(true).flatMap((scene) => scene.children.list.flatMap((obj) => candidate(scene, obj)));

  const hook: DevHook = {
    scenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    // A JSON copy: GameState is JSON-safe (saves serialize it), and a copy
    // means nothing a test does to the result reaches the game.
    state: () => (session.gameState ? JSON.parse(JSON.stringify(session.gameState)) : null),
    testScenario: () => session.testScenario,
    seed: (n) => {
      Math.random = createSeededRng(n);
    },
    reachable: (unitId) => {
      const st = session.gameState;
      const unit = st?.units.find((u) => u.id === unitId);
      if (!st || !unit) throw new Error(`No unit ${unitId}`);
      return [...reachableHexes(st, unit).keys()];
    },
    centerOn: (hex) => {
      const b = mapScene();
      const w = b.mapView.toScreen(hex);
      b.cameras.main.centerOn(w.x, w.y);
    },
    hexToCanvas: (hex) => {
      const b = mapScene();
      return worldToCanvas(b.cameras.main, b.mapView.toScreen(hex));
    },
    buttonCount: (label) => matchingButtons(buttons(), label).length,
    buttonToCanvas: (label, index) => pickButton(buttons(), label, index),
    busy: () => {
      if (!game.scene.isActive('Board')) return ['Board not active'];
      const b = board() as unknown as Record<string, unknown>;
      for (const f of BUSY_FIELDS) {
        if (!(f in b)) throw new Error(`devHook: BoardScene has no "${f}" field any more — update BUSY_FIELDS`);
      }
      const reasons: string[] = BUSY_FIELDS.filter((f) => b[f] !== false && b[f] !== null);
      const tweens = board().tweens.getTweens().length;
      if (tweens) reasons.push(`${tweens} tween(s)`);
      return reasons;
    },
    idle: () => hook.busy().length === 0,
    pendingHexes: () => {
      const choice = (board() as unknown as { retreatChoice: PendingChoice | null }).retreatChoice;
      if (!choice) return [];
      return choice.kind === 'retreat' ? (choice.legalHexes ?? []) : (choice.pushTargets ?? []).map((u) => u.position);
    },
    placement: () => {
      if (!game.scene.isActive('Placement')) throw new Error('Placement scene is not active');
      const p = game.scene.getScene('Placement') as unknown as PlacementInternals;
      for (const m of PLACEMENT_MEMBERS) {
        if (!(m in p)) throw new Error(`devHook: PlacementScene has no "${m}" any more � update PLACEMENT_MEMBERS`);
      }
      return { current: p.queue.find((q) => q.remaining > 0)?.typeId ?? null, legalHexes: p.currentLegalHexes() };
    },
  };
  (window as unknown as { __heraklios: DevHook }).__heraklios = hook;
}

/** A visible, interactive text object as a click target, at the pixel the camera that renders it draws it. */
function candidate(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject): ButtonCandidate[] {
  if (!(obj instanceof Phaser.GameObjects.Text) || !obj.visible || !obj.input?.enabled) return [];
  const cam = scene.cameras.cameras.find((c) => (obj.cameraFilter & c.id) === 0);
  if (!cam) return [];
  const b = obj.getBounds();
  const centre = { x: b.centerX, y: b.centerY };
  const pt = obj.scrollFactorX === 0 ? fixedToCanvas(cam, centre) : worldToCanvas(cam, centre);
  return pt ? [{ label: obj.text, ...pt }] : [];
}

/** A scroll-factor-0 (HUD) object: only the camera's viewport offset applies. */
function fixedToCanvas(cam: Phaser.Cameras.Scene2D.Camera, p: Point): Point | null {
  if (cam.zoom !== 1) throw new Error('devHook: a HUD object on a zoomed camera is not supported');
  return inside(cam, { x: cam.x + p.x, y: cam.y + p.y });
}

/** A world point through the camera's scroll and zoom; null if off-viewport. */
function worldToCanvas(cam: Phaser.Cameras.Scene2D.Camera, w: Point): Point | null {
  // getWorldPoint is affine; invert it from three samples (as in the §30 probe).
  const o = cam.getWorldPoint(0, 0);
  const ex = cam.getWorldPoint(1, 0);
  const ey = cam.getWorldPoint(0, 1);
  const a = ex.x - o.x;
  const c = ey.x - o.x;
  const b = ex.y - o.y;
  const d = ey.y - o.y;
  const det = a * d - b * c;
  const dx = w.x - o.x;
  const dy = w.y - o.y;
  return inside(cam, { x: (d * dx - c * dy) / det, y: (-b * dx + a * dy) / det });
}

function inside(cam: Phaser.Cameras.Scene2D.Camera, p: Point): Point | null {
  return p.x >= cam.x && p.x < cam.x + cam.width && p.y >= cam.y && p.y < cam.y + cam.height ? p : null;
}
