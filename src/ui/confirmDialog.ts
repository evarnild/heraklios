import Phaser from 'phaser';

export interface ConfirmDialogOptions {
  scene: Phaser.Scene;
  /** Shown as the dialog's body text; `\n` breaks lines. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /**
   * Scenes with a zoomable/pannable board (`BoardScene`, `PlacementScene`)
   * keep their HUD/prompts on a separate fixed camera via `MapView`'s
   * `pinUIObjects`/`excludeFromMainCamera` — pass that hook through here so
   * this dialog gets the same treatment and isn't affected by the map's pan
   * or zoom. Scenes with no such camera (`ArmyBuilderScene`) omit it.
   */
  excludeFromMainCamera?: (objects: Phaser.GameObjects.GameObject[]) => void;
}

/**
 * A modal Yes/No confirmation. Phaser renders entirely inside a `<canvas>`,
 * so a browser `confirm()`/`alert()` would either not appear at all or block
 * the render thread — this project never uses either (per CLAUDE.md);
 * everything is drawn as Phaser game objects instead, following the same
 * rectangle+text+buttons shape as `BoardScene`'s other prompts
 * (`promptRam`, `chooseAdvance`).
 *
 * Unlike those in-game prompts, this one adds a full-canvas backdrop that
 * swallows clicks — the same treatment `SaveLoadPanel` gives itself — since
 * this dialog exists specifically for the app's one genuinely destructive
 * action (abandoning a game in progress) and a stray click reaching the
 * board or a button underneath while it's open should never do anything.
 */
export function showConfirmDialog(options: ConfirmDialogOptions): void {
  const { scene, message, onConfirm, onCancel, excludeFromMainCamera } = options;
  const confirmLabel = options.confirmLabel ?? 'Yes';
  const cancelLabel = options.cancelLabel ?? 'Cancel';
  const { width, height } = scene.scale;

  // Depth 50+, above every other modal this app shows (SaveLoadPanel: 40/41;
  // BoardScene's ram/advance/exchange prompts: 20/21) — this dialog should
  // never be obscured or have its backdrop bypassed by something else left
  // open underneath it.
  const backdrop = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0.6)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(50)
    .setInteractive();
  backdrop.on('pointerdown', () => {
    /* swallow — clicks outside the panel do nothing */
  });

  const panelHeight = 150;
  const panel = scene.add
    .rectangle(width / 2, height / 2, 400, panelHeight, 0x1a1408, 0.98)
    .setScrollFactor(0)
    .setDepth(51)
    .setStrokeStyle(1, 0x4a3f2a, 1);

  const label = scene.add
    .text(width / 2, height / 2 - 34, message, {
      fontSize: '15px',
      color: '#fff',
      align: 'center',
      wordWrap: { width: 340 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(52);

  const confirmBtn = scene.add
    .text(width / 2 - 85, height / 2 + 44, confirmLabel, {
      fontSize: '15px',
      color: '#fff',
      backgroundColor: '#5a2a2a',
      padding: { x: 14, y: 8 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(52)
    .setInteractive({ useHandCursor: true });

  const cancelBtn = scene.add
    .text(width / 2 + 85, height / 2 + 44, cancelLabel, {
      fontSize: '15px',
      color: '#fff',
      backgroundColor: '#2a5a2a',
      padding: { x: 14, y: 8 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(52)
    .setInteractive({ useHandCursor: true });

  const objects = [backdrop, panel, label, confirmBtn, cancelBtn];
  excludeFromMainCamera?.(objects);

  const cleanup = () => {
    for (const object of objects) object.destroy();
  };

  confirmBtn.on('pointerdown', () => {
    cleanup();
    onConfirm();
  });
  cancelBtn.on('pointerdown', () => {
    cleanup();
    onCancel?.();
  });
}
