import Phaser from 'phaser';
import { formatSavedAt, type SavedGame } from '../engine/saveGame';
import { describeSlot, formatSaveError } from './i18n/format';
import { messages } from './i18n';
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
const SLOT_NAME_WIDTH = 140;
const ACTION_BUTTON_X = 440;
const ACTION_BUTTON_GAP = 16;
const SAVE_DESCRIPTION_WIDTH = ACTION_BUTTON_X - SLOT_NAME_WIDTH - ACTION_BUTTON_GAP;
const SAVE_DESCRIPTION_HEIGHT = 36;
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
  /** The row buttons that act on a saved slot (Load, Delete), dimmed while it is empty. */
  private needsSave = new WeakSet<Phaser.GameObjects.Text>();

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
        .text(width / 2, top + 24, this.config.mode === 'manage' ? messages().saves.panelManage : messages().saves.panelLoad, {
          fontSize: '18px',
          color: TEXT_COLOR,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(41),
    );

    const left = width / 2 - PANEL_WIDTH / 2 + 24;
    let y = top + 68;

    this.buildRow('autosave', messages().saves.autosave, left, y);
    y += ROW_HEIGHT;
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      this.buildRow(slot, messages().saves.slot(slot), left, y);
      y += ROW_HEIGHT;
    }

    // Footer: file import/export and close.
    const footerY = top + panelHeight - 28;
    let footerX = left;
    if (this.config.mode === 'manage') {
      const exportBtn = this.button(footerX, footerY, messages().saves.exportFile, '#4a3f2a', () => this.exportToFile());
      footerX += exportBtn.width + 12;
    }
    this.button(footerX, footerY, messages().saves.importFile, '#4a3f2a', () => this.importFromFile());
    this.button(width / 2 + PANEL_WIDTH / 2 - 90, footerY, messages().common.close, '#5a2a2a', () => this.close());

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
        .text(left + SLOT_NAME_WIDTH, y, '', {
          fontSize: '13px',
          color: MUTED_COLOR,
          fixedWidth: SAVE_DESCRIPTION_WIDTH,
          fixedHeight: SAVE_DESCRIPTION_HEIGHT,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(41),
    );
    this.rowLabels.set(key, label);

    const buttons: Phaser.GameObjects.Text[] = [];
    let x = left + ACTION_BUTTON_X;
    // The autosave slot is written by the game, never by hand — offering
    // "Save" there would just invite overwriting the crash-recovery copy.
    if (this.config.mode === 'manage' && slot !== 'autosave') {
      const saveBtn = this.button(x, y, messages().saves.save, '#2a5a2a', () => this.saveInto(slot));
      buttons.push(saveBtn);
      x += saveBtn.width + 8;
    }
    const loadBtn = this.button(x, y, messages().saves.load, '#3a3a55', () => this.loadFrom(slot));
    this.needsSave.add(loadBtn);
    buttons.push(loadBtn);
    x += loadBtn.width + 8;
    if (this.config.mode === 'manage') {
      const deleteBtn = this.button(x, y, messages().saves.delete, '#5a2a2a', () => this.deleteSlot(slot));
      this.needsSave.add(deleteBtn);
      buttons.push(deleteBtn);
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
    label?.setText(save ? `${describeSlot(save)}\n${formatSavedAt(save.savedAt)}` : messages().saves.empty);
    label?.setColor(save ? TEXT_COLOR : MUTED_COLOR);
    for (const btn of this.rowButtons.get(key) ?? []) {
      btn.setAlpha(this.needsSave.has(btn) && !save ? 0.4 : 1);
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
      this.status(messages().saves.savingFailed);
      return;
    }
    this.refreshRow(slot);
    this.status(existing ? messages().saves.overwrote(slot, describeSlot(save)) : messages().saves.savedTo(slot));
  }

  private loadFrom(slot: SlotId): void {
    const save = readSlot(slot);
    if (!save) {
      this.status(messages().saves.slotEmpty);
      return;
    }
    this.close();
    this.config.onLoad(save);
  }

  private deleteSlot(slot: SlotId): void {
    if (!readSlot(slot)) return;
    clearSlot(slot);
    this.refreshRow(slot);
    this.status(slot === 'autosave' ? messages().saves.clearedAutosave : messages().saves.clearedSlot(slot));
  }

  private exportToFile(): void {
    const capture = this.config.captureSave;
    if (!capture) return;
    downloadSave(capture());
    this.status(messages().saves.exported);
  }

  private importFromFile(): void {
    // Fire-and-forget: a cancelled file dialog never fires an event, so this
    // promise may simply never settle (see `pickSaveFile`).
    void pickSaveFile().then((result) => {
      if (!result) return;
      if ('error' in result) {
        this.status(formatSaveError(result.error));
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
