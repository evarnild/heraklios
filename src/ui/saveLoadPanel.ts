import Phaser from 'phaser';
import { formatSavedAt, type SavedGame } from '../engine/saveGame';
import { describeSlot, formatSaveError } from './i18n/format';
import { messages } from './i18n';
import {
  SLOT_COUNT,
  clearSave,
  copyBrowserSaves,
  downloadSave,
  hasCopyableBrowserSaves,
  pickSaveFile,
  readAllSaves,
  readSave,
  writeSave,
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
const STATUS_WIDTH = 390;
const ALL_SLOTS: SlotId[] = ['autosave', ...Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)];

/** What a row knows about its slot: nothing yet, nothing reachable, or the file's content. */
type RowState = { kind: 'loading' } | { kind: 'unreachable' } | { kind: 'ready'; save: SavedGame | null };

/**
 * The Save/Load overlay: one row per storage slot plus the autosave, with
 * JSON file export/import. Built as an in-scene overlay rather than its own
 * Phaser scene deliberately — leaving and re-entering BoardScene would re-run
 * its `create`, which resets movement points for the active player.
 *
 * The saves are files behind the local API (intents/45-save-api), so every
 * read is asynchronous. The rows start "Loading…" with their buttons off and
 * come on when the list arrives; one action runs at a time and each re-reads
 * the slot it acts on, so a click never works from a stale list.
 */
export class SaveLoadPanel {
  private scene: Phaser.Scene;
  private config: SaveLoadPanelConfig;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private rowLabels = new Map<string, Phaser.GameObjects.Text>();
  private rowButtons = new Map<string, Phaser.GameObjects.Text[]>();
  /** The row buttons that act on a saved slot (Load, Delete), dimmed while it is empty. */
  private needsSave = new WeakSet<Phaser.GameObjects.Text>();
  private statusText: Phaser.GameObjects.Text | null = null;
  private copyButton: Phaser.GameObjects.Text | null = null;
  /** The slots the server last reported as holding a save (the import offer reads it). */
  private files: Map<SlotId, SavedGame> | null = null;
  private closed = false;
  private busy = false;

  constructor(scene: Phaser.Scene, config: SaveLoadPanelConfig) {
    this.scene = scene;
    this.config = config;
    this.build();
    void this.loadList();
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
    const panelHeight = 148 + rowCount * ROW_HEIGHT;
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

    this.buildStatusLine(left, top + panelHeight - 62, left + PANEL_WIDTH - 48);

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

  /** The panel's own status line (the Menu has no log to report to) and the import offer beside it. */
  private buildStatusLine(left: number, y: number, right: number): void {
    this.statusText = this.add(
      this.scene.add
        .text(left, y, '', {
          fontSize: '12px',
          color: TEXT_COLOR,
          wordWrap: { width: STATUS_WIDTH },
          fixedWidth: STATUS_WIDTH,
          fixedHeight: SAVE_DESCRIPTION_HEIGHT,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(41),
    );
    const copy = this.button(right, y, messages().saves.copyBrowserSaves, '#4a3f2a', () => void this.copyFromBrowser());
    copy.setOrigin(1, 0.5);
    this.copyButton = copy;
    this.setEnabled(copy, false); // offered only once the file list says there is something to copy
    copy.setVisible(false);
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
      const saveBtn = this.button(x, y, messages().saves.save, '#2a5a2a', () => void this.saveInto(slot));
      buttons.push(saveBtn);
      x += saveBtn.width + 8;
    }
    const loadBtn = this.button(x, y, messages().saves.load, '#3a3a55', () => void this.loadFrom(slot));
    this.needsSave.add(loadBtn);
    buttons.push(loadBtn);
    x += loadBtn.width + 8;
    if (this.config.mode === 'manage') {
      const deleteBtn = this.button(x, y, messages().saves.delete, '#5a2a2a', () => void this.deleteSlot(slot));
      this.needsSave.add(deleteBtn);
      buttons.push(deleteBtn);
    }
    this.rowButtons.set(key, buttons);

    this.showRow(slot, { kind: 'loading' });
  }

  private setEnabled(btn: Phaser.GameObjects.Text, on: boolean): void {
    if (on) btn.setInteractive({ useHandCursor: true });
    else btn.disableInteractive();
    btn.setAlpha(on ? 1 : 0.4);
  }

  /** Shows what is known about one row: its description, and which buttons can act. */
  private showRow(slot: SlotId, state: RowState): void {
    const key = this.slotKey(slot);
    const save = state.kind === 'ready' ? state.save : null;
    const text =
      state.kind === 'loading'
        ? messages().saves.loading
        : state.kind === 'unreachable'
          ? messages().saves.unreachable
          : save
            ? `${describeSlot(save)}\n${formatSavedAt(save.savedAt)}`
            : messages().saves.empty;
    const label = this.rowLabels.get(key);
    label?.setText(text);
    label?.setColor(save ? TEXT_COLOR : MUTED_COLOR);
    for (const btn of this.rowButtons.get(key) ?? []) {
      // Save does not depend on the list (it re-reads its slot); Load and
      // Delete need a save there. While the list is loading nothing acts.
      const on = state.kind !== 'loading' && (!this.needsSave.has(btn) || save !== null);
      this.setEnabled(btn, on);
    }
  }

  /** Records a slot's new content and updates its row and the import offer. */
  private remember(slot: SlotId, save: SavedGame | null): void {
    if (this.closed) return;
    if (!this.files) this.files = new Map();
    if (save) this.files.set(slot, save);
    else this.files.delete(slot);
    this.showRow(slot, { kind: 'ready', save });
    this.updateCopyOffer();
  }

  private async loadList(): Promise<void> {
    const result = await readAllSaves();
    if (this.closed) return;
    if (!result.ok) {
      for (const slot of ALL_SLOTS) this.showRow(slot, { kind: 'unreachable' });
      this.status(messages().saves.unreachable);
      return;
    }
    this.files = result.value;
    for (const slot of ALL_SLOTS) this.showRow(slot, { kind: 'ready', save: result.value.get(slot) ?? null });
    this.updateCopyOffer();
  }

  /** The import offer shows while a valid browser save has no file yet (spec B8). */
  private updateCopyOffer(): void {
    const btn = this.copyButton;
    if (!btn || !this.files) return;
    const offer = hasCopyableBrowserSaves(this.files);
    btn.setVisible(offer);
    this.setEnabled(btn, offer);
  }

  private status(message: string): void {
    this.statusText?.setText(message);
    this.config.onStatus?.(message);
  }

  /** Runs one panel action at a time: a second click while one is in flight is ignored. */
  private async exclusive(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await action();
    } finally {
      this.busy = false;
    }
  }

  private saveInto(slot: SlotId): Promise<void> {
    return this.exclusive(async () => {
      const capture = this.config.captureSave;
      if (!capture) return;
      const save = capture(); // the position at the click, not after the round trip
      // Read through the list, not the slot: an empty slot is a 404 there, which the
      // browser would print in its console as an error on every first save.
      const files = await readAllSaves();
      const existing = files.ok ? files.value.get(slot) : undefined;
      if (!files.ok || !(await writeSave(slot, save))) {
        this.status(messages().saves.savingFailed);
        return;
      }
      this.remember(slot, save);
      this.status(existing ? messages().saves.overwrote(slot, describeSlot(save)) : messages().saves.savedTo(slot));
    });
  }

  private loadFrom(slot: SlotId): Promise<void> {
    return this.exclusive(async () => {
      const result = await readSave(slot);
      if (this.closed) return;
      if (!result.ok) {
        this.status(messages().saves.loadingFailed);
        return;
      }
      if (!result.value) {
        this.remember(slot, null);
        this.status(messages().saves.slotEmpty);
        return;
      }
      this.close();
      this.config.onLoad(result.value);
    });
  }

  private deleteSlot(slot: SlotId): Promise<void> {
    return this.exclusive(async () => {
      const existing = await readSave(slot);
      if (!existing.ok) {
        this.status(messages().saves.deletingFailed);
        return;
      }
      if (!existing.value) {
        this.remember(slot, null);
        return;
      }
      if (!(await clearSave(slot))) {
        this.status(messages().saves.deletingFailed);
        return;
      }
      this.remember(slot, null);
      this.status(slot === 'autosave' ? messages().saves.clearedAutosave : messages().saves.clearedSlot(slot));
    });
  }

  /** Spec B8: copy browser saves into empty file slots, then refresh what the rows show. */
  private copyFromBrowser(): Promise<void> {
    return this.exclusive(async () => {
      const result = await copyBrowserSaves();
      if (!result) {
        this.status(messages().saves.savingFailed);
        return;
      }
      this.status(messages().saves.copiedBrowserSaves(result.copied, result.skipped));
      await this.loadList();
    });
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
    this.closed = true;
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.rowLabels.clear();
    this.rowButtons.clear();
    this.statusText = null;
    this.copyButton = null;
  }
}
