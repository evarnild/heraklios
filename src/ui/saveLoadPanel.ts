import Phaser from 'phaser';
import { describeSave, formatSavedAt, type SavedGame } from '../engine/saveGame';
import {
  SLOT_COUNT,
  clearSlot,
  downloadSave,
  pickSaveFile,
  readSlot,
  writeSlot,
  type SlotId,
} from './saveStorage';

export interface SaveLoadPanelConfig {
  /**
   * 'manage' (from the Board) offers saving, loading, deleting and export.
   * 'load' (from the Menu) offers only loading and import, since there's no
   * game in progress to save.
   */
  mode: 'manage' | 'load';
  /** Required in 'manage' mode: produces the save to write into a slot. */
  captureSave?: () => SavedGame;
  onLoad: (save: SavedGame) => void;
  /** Where to report outcomes ("Saved to slot 2") — the board's log panel. */
  onStatus?: (message: string) => void;
  /**
   * Lets the Board keep these objects out of its zoomable map camera, the
   * same treatment its other prompts get via `MapView.excludeFromMainCamera`.
   */
  onObjectsCreated?: (objects: Phaser.GameObjects.GameObject[]) => void;
}

const PANEL_WIDTH = 720;
const ROW_HEIGHT = 44;
const TEXT_COLOR = '#e8d9b0';
const MUTED_COLOR = '#8a7c5c';

/**
 * The Save/Load overlay: one row per storage slot plus the autosave, with
 * JSON file export/import. Built as an in-scene overlay rather than its own
 * Phaser scene deliberately — leaving and re-entering BoardScene would re-run
 * its `create`, which resets movement points for the active player.
 */
export class SaveLoadPanel {
  private scene: Phaser.Scene;
  private config: SaveLoadPanelConfig;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private rowLabels = new Map<string, Phaser.GameObjects.Text>();
  private rowButtons = new Map<string, Phaser.GameObjects.Text[]>();

  constructor(scene: Phaser.Scene, config: SaveLoadPanelConfig) {
    this.scene = scene;
    this.config = config;
    this.build();
  }

  private slotKey(slot: SlotId): string {
    return `${slot}`;
  }

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private button(x: number, y: number, label: string, color: string, onClick: () => void): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(x, y, label, {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: color,
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(41)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    return this.add(btn);
  }

  private build(): void {
    const { width, height } = this.scene.scale;
    const rowCount = SLOT_COUNT + 1; // manual slots + autosave
    const panelHeight = 120 + rowCount * ROW_HEIGHT;
    const top = height / 2 - panelHeight / 2;

    // Full-canvas interactive backdrop: dims the board and, because Phaser's
    // input is topOnly by default, swallows clicks that would otherwise reach
    // the hexes underneath.
    const backdrop = this.add(
      this.scene.add
        .rectangle(0, 0, width, height, 0x000000, 0.6)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(40)
        .setInteractive(),
    );
    backdrop.on('pointerdown', () => {
      /* swallow */
    });

    this.add(
      this.scene.add
        .rectangle(width / 2, height / 2, PANEL_WIDTH, panelHeight, 0x1a1408, 0.98)
        .setScrollFactor(0)
        .setDepth(40)
        .setStrokeStyle(1, 0x4a3f2a, 1),
    );

    this.add(
      this.scene.add
        .text(width / 2, top + 24, this.config.mode === 'manage' ? 'Save / Load' : 'Load a saved game', {
          fontSize: '18px',
          color: TEXT_COLOR,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(41),
    );

    const left = width / 2 - PANEL_WIDTH / 2 + 24;
    let y = top + 68;

    this.buildRow('autosave', 'Autosave', left, y);
    y += ROW_HEIGHT;
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      this.buildRow(slot, `Slot ${slot}`, left, y);
      y += ROW_HEIGHT;
    }

    // Footer: file import/export and close.
    const footerY = top + panelHeight - 28;
    let footerX = left;
    if (this.config.mode === 'manage') {
      this.button(footerX, footerY, 'Export to file', '#4a3f2a', () => this.exportToFile());
      footerX += 130;
    }
    this.button(footerX, footerY, 'Import from file', '#4a3f2a', () => this.importFromFile());
    this.button(width / 2 + PANEL_WIDTH / 2 - 90, footerY, 'Close', '#5a2a2a', () => this.close());

    this.config.onObjectsCreated?.(this.objects);
  }

  private buildRow(slot: SlotId, name: string, left: number, y: number): void {
    const key = this.slotKey(slot);
    this.add(
      this.scene.add
        .text(left, y, name, { fontSize: '14px', color: TEXT_COLOR })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(41),
    );

    const label = this.add(
      this.scene.add
        .text(left + 90, y, '', { fontSize: '13px', color: MUTED_COLOR })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(41),
    );
    this.rowLabels.set(key, label);

    const buttons: Phaser.GameObjects.Text[] = [];
    let x = left + 400;
    // The autosave slot is written by the game, never by hand — offering
    // "Save" there would just invite overwriting the crash-recovery copy.
    if (this.config.mode === 'manage' && slot !== 'autosave') {
      buttons.push(this.button(x, y, 'Save', '#2a5a2a', () => this.saveInto(slot)));
      x += 62;
    }
    buttons.push(this.button(x, y, 'Load', '#3a3a55', () => this.loadFrom(slot)));
    x += 62;
    if (this.config.mode === 'manage') {
      buttons.push(this.button(x, y, 'Delete', '#5a2a2a', () => this.deleteSlot(slot)));
    }
    this.rowButtons.set(key, buttons);

    this.refreshRow(slot);
  }

  /** Updates one row's description and greys out actions that can't apply to
   * an empty slot. */
  private refreshRow(slot: SlotId): void {
    const key = this.slotKey(slot);
    const save = readSlot(slot);
    const label = this.rowLabels.get(key);
    label?.setText(save ? `${describeSave(save)} · ${formatSavedAt(save.savedAt)}` : '— empty —');
    label?.setColor(save ? TEXT_COLOR : MUTED_COLOR);
    for (const btn of this.rowButtons.get(key) ?? []) {
      const needsSave = btn.text === 'Load' || btn.text === 'Delete';
      btn.setAlpha(needsSave && !save ? 0.4 : 1);
    }
  }

  private status(message: string): void {
    this.config.onStatus?.(message);
  }

  private saveInto(slot: SlotId): void {
    const capture = this.config.captureSave;
    if (!capture) return;
    const existing = readSlot(slot);
    const save = capture();
    if (!writeSlot(slot, save)) {
      this.status('Saving failed — browser storage is full or unavailable.');
      return;
    }
    this.refreshRow(slot);
    this.status(existing ? `Overwrote slot ${slot} (${describeSave(save)}).` : `Saved to slot ${slot}.`);
  }

  private loadFrom(slot: SlotId): void {
    const save = readSlot(slot);
    if (!save) {
      this.status('That slot is empty.');
      return;
    }
    this.close();
    this.config.onLoad(save);
  }

  private deleteSlot(slot: SlotId): void {
    if (!readSlot(slot)) return;
    clearSlot(slot);
    this.refreshRow(slot);
    this.status(`Cleared ${slot === 'autosave' ? 'the autosave' : `slot ${slot}`}.`);
  }

  private exportToFile(): void {
    const capture = this.config.captureSave;
    if (!capture) return;
    downloadSave(capture());
    this.status('Exported the current game to a .json file.');
  }

  private importFromFile(): void {
    // Fire-and-forget: a cancelled file dialog never fires an event, so this
    // promise may simply never settle (see `pickSaveFile`).
    void pickSaveFile().then((result) => {
      if (!result) return;
      if ('error' in result) {
        this.status(result.error);
        return;
      }
      this.close();
      this.config.onLoad(result.save);
    });
  }

  close(): void {
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.rowLabels.clear();
    this.rowButtons.clear();
  }
}
