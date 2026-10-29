import Phaser from 'phaser';
import { MAX_RAMMING_BONUS } from '../data/navalRamming';
import {
  boardingTable,
  landCombatHighlight,
  landCombatTable,
  rammingTable,
  terrainTable,
  type LandCombatHighlight,
} from '../engine/ruleTables';
import { messages } from './i18n';
import { terrainName, unitCategoryName, unitName } from './i18n/names';

export type RulesTab = 'terrain' | 'land' | 'ramming' | 'boarding';
const TABS: readonly RulesTab[] = ['terrain', 'land', 'ramming', 'boarding'];

/** The forces and die modifier of the attack being built (`previewLandAttack`'s fields this panel reads). */
export interface RulesAttack {
  attackForce: number;
  defenseForce: number;
  terrainModifier: number;
}

export interface RulesPanelConfig {
  /** Keeps the panel's objects out of the zoomable map camera (as the Board's other prompts do). */
  onObjectsCreated: (objects: Phaser.GameObjects.GameObject[]) => void;
}

const PANEL_W = 580;
const PANEL_H = 392;
const MARGIN = 12;
const DEPTH = 35;
const PAD = 14;
const TEXT_COLOR = '#e8d9b0';
const MUTED_COLOR = '#8a7c5c';
const CELL_FILL = 0x241b0c;
const HEADER_FILL = 0x3a2f18;
const COLUMN_FILL = 0x4a3f1a;
const HIT_FILL = 0x9a7a1a;
const NO_RESULT_FILL = 0x7a3a4a;

interface Cell {
  text: string;
  fill?: number;
  color?: string;
}

/**
 * The board's Tables panel (§55): the terrain table and the land, ramming and
 * boarding results tables, drawn from `engine/ruleTables.ts` (which reads the
 * game's own data), with the land table's column and die cells for the attack
 * being built highlighted. An in-scene overlay like the Save / Load panel, but
 * not modal: only its own rectangle swallows clicks, so the board keeps working.
 * It changes no game state.
 */
export class RulesPanel {
  private scene: Phaser.Scene;
  private config: RulesPanelConfig;
  private shell: Phaser.GameObjects.GameObject[] = [];
  private content: Phaser.GameObjects.GameObject[] = [];
  private tab: RulesTab | null = null;
  private attack: RulesAttack | null = null;
  private opened = false;
  private bounds = { left: 0, top: 0 };

  constructor(scene: Phaser.Scene, config: RulesPanelConfig) {
    this.scene = scene;
    this.config = config;
  }

  isOpen(): boolean {
    return this.opened;
  }

  /** What a smoke test reads: whether it is open, the tab, and the highlight. */
  snapshot(): { open: boolean; tab: RulesTab | null; highlight: LandCombatHighlight | null } {
    return { open: this.opened, tab: this.tab, highlight: landCombatHighlight(this.attack) };
  }

  /** True for a screen point on the panel (the map must not pan or zoom there). */
  contains(x: number, y: number): boolean {
    if (!this.opened) return false;
    const { left, top } = this.bounds;
    return x >= left && x <= left + PANEL_W && y >= top && y <= top + PANEL_H;
  }

  /** Opens on `defaultTab` the first time, then on the last tab chosen; closes if open. */
  toggle(defaultTab: RulesTab): void {
    if (this.opened) this.close();
    else this.open(defaultTab);
  }

  open(defaultTab: RulesTab): void {
    if (this.opened) return;
    this.opened = true;
    this.tab ??= defaultTab;
    const { width } = this.scene.scale;
    this.bounds = { left: width - PANEL_W - MARGIN, top: MARGIN };
    this.buildShell();
    this.render();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    for (const o of [...this.shell, ...this.content]) o.destroy();
    this.shell = [];
    this.content = [];
  }

  /** The attack being built, or null: the land tab highlights it while open. */
  setAttack(attack: RulesAttack | null): void {
    this.attack = attack;
    if (this.opened) this.render();
  }

  /** Back to a fresh state (a new game or a load: nothing carries over). */
  reset(): void {
    this.close();
    this.attack = null;
    this.tab = null;
  }

  private track<T extends Phaser.GameObjects.GameObject>(list: Phaser.GameObjects.GameObject[], object: T): T {
    list.push(object);
    return object;
  }

  /** The background (which swallows clicks), the tab buttons and Close; built once per opening. */
  private buildShell(): void {
    const { left, top } = this.bounds;
    const bg = this.scene.add
      .rectangle(left, top, PANEL_W, PANEL_H, 0x1a1408, 0.97)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setStrokeStyle(1, 0x4a3f2a, 1)
      .setInteractive();
    bg.on('pointerdown', () => {
      /* swallow: the click is on the panel, not the map under it */
    });
    this.track(this.shell, bg);
    let x = left + PAD;
    for (const tab of TABS) {
      const label = this.button(x, top + 20, messages().rules.tabs[tab], '#4a3f2a', () => this.setTab(tab));
      x += label.width + 6;
      this.track(this.shell, label);
    }
    const close = this.button(left + PANEL_W - PAD, top + 20, messages().rules.close, '#5a2a2a', () => this.close());
    close.setOrigin(1, 0.5);
    this.track(this.shell, close);
    this.config.onObjectsCreated(this.shell);
  }

  private button(x: number, y: number, label: string, color: string, onClick: () => void): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(x, y, label, { fontSize: '12px', color: '#fff', backgroundColor: color, padding: { x: 7, y: 4 } })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    return btn;
  }

  private setTab(tab: RulesTab): void {
    this.tab = tab;
    this.render();
  }

  private render(): void {
    for (const o of this.content) o.destroy();
    this.content = [];
    const body = { x: this.bounds.left + PAD, y: this.bounds.top + 48 };
    switch (this.tab) {
      case 'land':
        this.renderLand(body);
        break;
      case 'ramming':
        this.renderRamming(body);
        break;
      case 'boarding':
        this.renderBoarding(body);
        break;
      default:
        this.renderTerrain(body);
    }
    this.config.onObjectsCreated(this.content);
  }

  private text(x: number, y: number, text: string, color = TEXT_COLOR): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, text, { fontSize: '11px', color, wordWrap: { width: PANEL_W - 2 * PAD } })
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    return this.track(this.content, t);
  }

  /** Draws a grid of cells and returns the y below it. */
  private grid(x: number, top: number, colWidths: number[], rowHeight: number, rows: Cell[][]): number {
    let y = top;
    for (const row of rows) {
      let cx = x;
      row.forEach((cell, c) => {
        const w = colWidths[c]!;
        const rect = this.scene.add
          .rectangle(cx, y, w - 2, rowHeight - 2, cell.fill ?? CELL_FILL, 1)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(DEPTH + 1);
        this.track(this.content, rect);
        const label = this.scene.add
          .text(cx + w / 2 - 1, y + rowHeight / 2 - 1, cell.text, {
            fontSize: '11px',
            color: cell.color ?? TEXT_COLOR,
            align: 'center',
            wordWrap: { width: w - 8 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(DEPTH + 2);
        this.track(this.content, label);
        cx += w;
      });
      y += rowHeight;
    }
    return y;
  }

  private renderTerrain(at: { x: number; y: number }): void {
    const t = messages().rules;
    const table = terrainTable();
    const head = t.terrainHeaders;
    const header: Cell[] = [head.terrain, head.moveCost, head.modifier, head.forbidden].map((text) => ({
      text,
      fill: HEADER_FILL,
    }));
    const rows: Cell[][] = table.rows.map((row) => [
      { text: terrainName(row.terrain) },
      { text: String(row.moveCost) },
      { text: row.fromBelowOnly ? t.modifierFromBelow(row.combatModifier) : t.modifierFlat(row.combatModifier) },
      { text: row.forbiddenFor.length ? row.forbiddenFor.map(unitCategoryName).join(', ') : t.nobody },
    ]);
    rows.push([
      { text: t.riverCrossing },
      { text: t.riverCrossingCost(table.riverCrossing.extraMoveCost) },
      { text: t.modifierFlat(table.riverCrossing.combatModifier) },
      { text: t.nobody },
    ]);
    const y = this.grid(at.x, at.y, [150, 80, 220, 100], 38, [header, ...rows]);
    this.text(at.x, y + 8, t.terrainNote, MUTED_COLOR);
  }

  private renderLand(at: { x: number; y: number }): void {
    const t = messages().rules;
    const table = landCombatTable();
    const hl = landCombatHighlight(this.attack);
    if (hl) {
      const column = table.columns[hl.column]!;
      this.text(at.x, at.y, t.highlight(hl.attackForce, hl.defenseForce, column, hl.modifier), '#f0d070');
    }
    const header: Cell[] = [{ text: t.dieHeader, fill: HEADER_FILL }];
    table.columns.forEach((label, c) => header.push({ text: label, fill: hl?.column === c ? HIT_FILL : HEADER_FILL }));
    const hitRows = new Set(hl?.cells.map((cell) => cell.row));
    const rows: Cell[][] = table.rows.map((row, d) => [
      { text: String(d + 1), fill: HEADER_FILL },
      ...row.map((code, c): Cell => {
        if (hl?.column !== c) return { text: code };
        return { text: code, fill: hitRows.has(d + 1) ? HIT_FILL : COLUMN_FILL };
      }),
    ]);
    const y = this.grid(at.x, at.y + 18, [46, ...table.columns.map(() => 50)], 24, [header, ...rows]);
    this.text(at.x, y + 8, t.landLegend.join('\n'), MUTED_COLOR);
  }

  private renderRamming(at: { x: number; y: number }): void {
    const t = messages().rules;
    const table = rammingTable();
    const header: Cell[] = [
      { text: t.rammingAttacker, fill: HEADER_FILL },
      ...table.ships.map((s) => ({ text: unitName(s), fill: HEADER_FILL })),
    ];
    const rows: Cell[][] = table.ships.map((ship, a) => [
      { text: unitName(ship), fill: HEADER_FILL },
      ...table.cells[a]!.map((faces): Cell => ({ text: faces.join('-') })),
    ]);
    const y = this.grid(at.x, at.y, [150, 100, 100, 100, 100], 34, [header, ...rows]);
    this.text(at.x, y + 8, t.rammingLegend(MAX_RAMMING_BONUS), MUTED_COLOR);
  }

  private renderBoarding(at: { x: number; y: number }): void {
    const t = messages().rules;
    const table = boardingTable();
    const header: Cell[] = [
      { text: t.dieHeader, fill: HEADER_FILL },
      ...table.columns.map((c) => ({ text: c, fill: HEADER_FILL })),
    ];
    const rows: Cell[][] = table.rows.map((row, d) => [
      { text: String(d + 1), fill: HEADER_FILL },
      ...table.codes[d]!.map((code): Cell => (code === null ? { text: '', fill: NO_RESULT_FILL } : { text: code })),
    ]);
    const y = this.grid(at.x, at.y, [50, ...table.columns.map(() => 70)], 26, [header, ...rows]);
    this.text(at.x, y + 8, t.boardingLegend.join('\n'), MUTED_COLOR);
  }
}
