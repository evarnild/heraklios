import Phaser from 'phaser';
import type { PlayerId } from '../engine/state';
import type { MapView } from './MapView';
import { messages } from './i18n';
import { session } from './session';
import { SCORE_HEADER_H, SCORE_PANEL_W, SCORE_ROW_H, scorePanelRect, scorePanelRows, type ScoreRow } from './scorePanelLayout';
import type { Rect } from './rulesPanelLayout';

/**
 * The Board's always-on score panel (§81): one row per player at the bottom
 * right, drawn on the fixed HUD camera. It owns no rule: the figures come from
 * the engine's `playerScores` through `scorePanelLayout.ts`, and it re-reads
 * `session.gameState` every frame (the scene's UPDATE event), redrawing only
 * when a row's text or the active player changes. So combat, drift, rams,
 * undo, redo, a load and a computer turn all show within one frame, and the
 * scene needs no per-action call.
 */
const DEPTH = 30;

interface RowObjects {
  highlight: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Triangle;
  square: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  points: Phaser.GameObjects.Text;
  atSea: Phaser.GameObjects.Text;
  units: Phaser.GameObjects.Text;
}

export interface ScorePanelSnapshot {
  rect: Rect;
  /** True when every row's text lies inside the rectangle. */
  fits: boolean;
  rows: { playerId: PlayerId; score: number; atSea: boolean; unitsLeft: number; active: boolean }[];
}

const PANELS = new WeakMap<Phaser.Scene, ScorePanel>();

export class ScorePanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly rows: RowObjects[] = [];
  private readonly rect: Rect;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly header: Phaser.GameObjects.Text;
  private lastKey = '';
  private ids: PlayerId[] = [];

  constructor(private readonly scene: Phaser.Scene, mapView: MapView, playerCount: number) {
    this.rect = scorePanelRect(scene.scale.width, scene.scale.height, playerCount);
    const { left, top, width, height } = this.rect;
    this.bg = scene.add
      .rectangle(left, top, width, height, 0x1a1408, 0.9)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setStrokeStyle(1, 0x4a3f2a, 1)
      .setInteractive();
    this.bg.on('pointerdown', () => {
      /* swallow: the click is on the panel, not the hex under it */
    });
    this.header = this.text(left + 10, top + 6, 12, '#e8d9b0');
    this.objects.push(this.bg, this.header);
    for (let i = 0; i < playerCount; i++) this.rows.push(this.buildRow(top + SCORE_HEADER_H - 6 + i * SCORE_ROW_H));
    mapView.excludeFromMainCamera(this.objects);
    this.setVisible(false);
  }

  private text(x: number, y: number, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, '', { fontSize: `${size}px`, color })
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
  }

  private buildRow(y: number): RowObjects {
    const left = this.rect.left;
    const mid = y + SCORE_ROW_H / 2;
    const add = this.scene.add;
    const highlight = add
      .rectangle(left + 3, y, SCORE_PANEL_W - 6, SCORE_ROW_H, 0x4a3f2a, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    const marker = add.triangle(left + 10, mid, 0, 0, 0, 10, 7, 5, 0xe8d9b0).setScrollFactor(0).setDepth(DEPTH + 2);
    const square = add.rectangle(left + 25, mid, 10, 10, 0xffffff).setScrollFactor(0).setDepth(DEPTH + 2);
    const name = this.text(left + 34, y + 2, 12, '#fff');
    const points = this.text(left + 150, y + 2, 12, '#fff').setOrigin(1, 0);
    const atSea = this.text(left + 156, y + 3, 11, '#8fd3ff');
    const units = this.text(left + SCORE_PANEL_W - 6, y + 3, 11, '#c8b88a').setOrigin(1, 0);
    this.objects.push(highlight, marker, square, name, points, atSea, units);
    return { highlight, marker, square, name, points, atSea, units };
  }

  private setVisible(visible: boolean): void {
    for (const o of this.objects) (o as unknown as { setVisible(v: boolean): void }).setVisible(visible);
  }

  /** Called every frame: redraws only when the rows (or the language) changed. */
  refresh(): void {
    const state = session.gameState;
    if (!state) {
      if (this.lastKey !== '') this.setVisible(false);
      this.lastKey = '';
      return;
    }
    const t = messages();
    const rows = scorePanelRows(state, t);
    const key = JSON.stringify([t.board.scoreHeader, rows]);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.setVisible(true);
    this.header.setText(t.board.scoreHeader);
    this.ids = rows.map((r) => r.playerId);
    this.rows.forEach((objs, i) => this.drawRow(objs, rows[i]));
  }

  private drawRow(objs: RowObjects, row: ScoreRow | undefined): void {
    for (const o of Object.values(objs)) o.setVisible(row !== undefined);
    if (!row) return;
    objs.highlight.setVisible(row.active);
    objs.marker.setVisible(row.active);
    objs.square.setFillStyle(Phaser.Display.Color.HexStringToColor(row.color).color);
    objs.name.setText(row.name).setColor(row.color);
    objs.points.setText(row.points);
    objs.atSea.setText(row.atSea ?? '').setVisible(row.atSea !== null);
    objs.units.setText(row.units);
  }

  /** True for a screen point on the panel (the map must not pan or zoom there). */
  contains(x: number, y: number): boolean {
    const { left, top, width, height } = this.rect;
    return x >= left && x <= left + width && y >= top && y <= top + height;
  }

  /** What a smoke test reads: the rectangle and, per row, what is drawn. */
  snapshot(): ScorePanelSnapshot {
    const { left, top, width, height } = this.rect;
    let fits = true;
    const rows = this.rows
      .filter((r) => r.name.visible)
      .map((r, i) => {
        for (const t of [r.name, r.points, r.atSea, r.units]) {
          if (!t.visible) continue;
          const b = t.getBounds();
          if (b.left < left || b.top < top || b.right > left + width || b.bottom > top + height) fits = false;
        }
        return {
          playerId: this.ids[i]!,
          score: Number(/\d+/.exec(r.points.text)![0]),
          atSea: r.atSea.visible,
          unitsLeft: Number(/\d+/.exec(r.units.text)![0]),
          active: r.highlight.visible,
        };
      });
    return { rect: this.rect, fits, rows };
  }
}

/** Creates the panel on the Board, wires its per-frame refresh and registers it for the dev hook. */
export function createScorePanel(scene: Phaser.Scene, mapView: MapView): ScorePanel {
  const count = session.gameState ? session.gameState.players.length : 0;
  const panel = new ScorePanel(scene, mapView, count);
  const onUpdate = (): void => panel.refresh();
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    PANELS.delete(scene);
  });
  PANELS.set(scene, panel);
  panel.refresh();
  return panel;
}

/** The dev hook's reader; throws when the scene has no score panel. */
export function scorePanelSnapshot(scene: Phaser.Scene): ScorePanelSnapshot {
  const panel = PANELS.get(scene);
  if (!panel) throw new Error('This scene has no score panel');
  return panel.snapshot();
}
