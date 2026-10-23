/**
 * The Board's log panel (§49): draws a `LogHistory` in a fixed rectangle of
 * the left column. A pool of one-line texts, exactly as many as fit, so
 * nothing can be drawn outside the bounds (no mask: a mask across the main
 * and the HUD camera is a known Phaser trap). Scrolls by whole lines, by the
 * wheel over the panel or by dragging the scrollbar thumb. The scrolling
 * rules are the pure functions in `logHistory.ts`.
 */
import Phaser from 'phaser';
import type { MapView } from './MapView';
import {
  LINE_HEIGHT,
  LineLayout,
  type DisplayLine,
  type LogBounds,
  type LogHistory,
  clampOffset,
  follow,
  offsetForThumb,
  thumb,
  visibleLineCount,
} from './logHistory';

const DIM = '#a89878';
const NEWEST = '#d8c8a0';
const HEADING = '#e8d9b0';
const FONT_SIZE = '13px';
const SCROLLBAR_WIDTH = 8;
const MIN_THUMB = 16;
const WHEEL_LINES = 3;
const DEPTH = 29;

export interface LogPanel {
  readonly bounds: LogBounds;
  /** Lays the history out, follows the bottom if the view was there, redraws. */
  render(history: LogHistory): void;
  contains(x: number, y: number): boolean;
  /** Current scroll state, in whole lines (read by the dev hook). */
  readonly offset: number;
  readonly total: number;
  readonly visible: number;
  /** The thumb's rectangle in canvas coordinates, null when everything fits. */
  thumbRect(): { x: number; y: number; width: number; height: number } | null;
}

/** Moves and resizes the thumb, and its hit area with it. */
function placeThumb(rect: Phaser.GameObjects.Rectangle, x: number, y: number, size: number): void {
  rect.setPosition(x, y);
  rect.setSize(SCROLLBAR_WIDTH, size);
  const hit = rect.input?.hitArea as Phaser.Geom.Rectangle | undefined;
  if (hit) hit.setSize(SCROLLBAR_WIDTH, size);
}

/** Puts the slice of `lines` from `offset` into the pooled texts. */
function drawLines(pool: Phaser.GameObjects.Text[], lines: DisplayLine[], offset: number): void {
  pool.forEach((t, i) => {
    const line = lines[offset + i];
    // Phaser redraws a Text on every set call, even for an unchanged value.
    if (!line) {
      if (t.text !== '') t.setText('');
      return;
    }
    const color = line.kind === 'heading' ? HEADING : line.newest ? NEWEST : DIM;
    const fontStyle = line.kind === 'heading' ? 'bold' : '';
    if (t.text !== line.text) t.setText(line.text);
    if (t.style.color !== color) t.setColor(color);
    if (t.style.fontStyle !== fontStyle) t.setFontStyle(fontStyle);
  });
}

function inBounds(b: LogBounds, x: number, y: number): boolean {
  return x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.bottom;
}

export function createLogPanel(scene: Phaser.Scene, mapView: MapView, bounds: LogBounds): LogPanel {
  const visible = visibleLineCount(bounds, LINE_HEIGHT);
  const wrapWidth = bounds.width - SCROLLBAR_WIDTH - 4;
  const trackH = visible * LINE_HEIGHT;
  const trackX = bounds.left + bounds.width - SCROLLBAR_WIDTH;

  const measure = scene.add
    .text(0, 0, '', { fontSize: FONT_SIZE, wordWrap: { width: wrapWidth } })
    .setVisible(false);
  const layout = new LineLayout((text) => measure.getWrappedText(text));

  const pool: Phaser.GameObjects.Text[] = [];
  for (let i = 0; i < visible; i++) {
    pool.push(scene.add.text(bounds.left, bounds.top + i * LINE_HEIGHT, '', { fontSize: FONT_SIZE, color: DIM }));
  }
  const track = scene.add.rectangle(trackX, bounds.top, SCROLLBAR_WIDTH, trackH, 0x2a2014, 1).setOrigin(0, 0);
  // Only the thumb is interactive (and a rectangle, not a Text): a log line
  // reading "Undo" must never be found as a button by the dev hook.
  const thumbRect = scene.add.rectangle(trackX, bounds.top, SCROLLBAR_WIDTH, MIN_THUMB, 0x8a7a55, 1).setOrigin(0, 0);
  thumbRect.setInteractive({ useHandCursor: true });
  const all = [measure, ...pool, track, thumbRect];
  for (const o of all) o.setScrollFactor(0).setDepth(DEPTH);
  mapView.excludeFromMainCamera(all);

  let lines: DisplayLine[] = [];
  let offset = 0;
  let dragGrab: number | null = null;

  const draw = (): void => {
    drawLines(pool, lines, offset);
    const th = thumb(lines.length, visible, offset, trackH, MIN_THUMB);
    track.setVisible(th !== null);
    thumbRect.setVisible(th !== null);
    if (th) placeThumb(thumbRect, trackX, bounds.top + th.top, th.size);
  };

  const contains = (x: number, y: number): boolean => inBounds(bounds, x, y);

  const scrollTo = (next: number): void => {
    const clamped = clampOffset(next, lines.length, visible);
    if (clamped === offset) return;
    offset = clamped;
    draw();
  };

  scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, deltaY: number) => {
    if (!contains(pointer.x, pointer.y)) return;
    scrollTo(offset + (deltaY > 0 ? WHEEL_LINES : -WHEEL_LINES));
  });
  thumbRect.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    dragGrab = pointer.y - thumbRect.y;
  });
  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (dragGrab === null) return;
    if (!pointer.isDown) {
      dragGrab = null;
      return;
    }
    const top = pointer.y - dragGrab - bounds.top;
    scrollTo(offsetForThumb(top, lines.length, visible, trackH, MIN_THUMB));
  });
  scene.input.on('pointerup', () => {
    dragGrab = null;
  });

  return {
    bounds,
    render(history) {
      const prevTotal = lines.length;
      lines = layout.layout(history.entries(), history.newest());
      offset = follow(offset, prevTotal, lines.length, visible);
      draw();
    },
    contains,
    get offset() {
      return offset;
    },
    get total() {
      return lines.length;
    },
    get visible() {
      return visible;
    },
    thumbRect() {
      if (!thumbRect.visible) return null;
      return { x: thumbRect.x, y: thumbRect.y, width: thumbRect.width, height: thumbRect.height };
    },
  };
}
