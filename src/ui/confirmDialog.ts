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
 * Module-level, not per-scene: only one scene is ever active in this
 * single-page hotseat app, and every caller of `showConfirmDialog` opens
 * from whichever scene is currently running.
 *
 * Guards against a genuine re-entrancy hole: the backdrop below blocks a
 * SECOND click across separate frames/events, but not a second click within
 * the SAME frame. Phaser's `MouseManager` dispatches DOM mouse events
 * synchronously, and its `InputPlugin` sorts hit-test candidates by each
 * object's index in `pointer.camera.renderList` — a backdrop created during
 * click #1 hasn't been added to that render list yet (rendering happens
 * later in the frame), so it sorts as index 0, below the button that opened
 * it, and `topOnly` picks that same button again. Two clicks landing in one
 * frame (Phaser's input plugin can batch queued pointer events) would
 * therefore open two stacked dialogs; dismissing the top one would leave the
 * other as a permanently visible, backdrop-having orphan.
 */
let dialogOpen = false;

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
 * That backdrop only intercepts *object* clicks, same as `SaveLoadPanel`'s:
 * map drag/zoom (`MapView.enableDrag`/`enableZoom`) and the Ctrl+Z/Y undo
 * shortcuts are scene-level input, not routed through any game object, so
 * they still work while this is open. Matches existing behavior, not a
 * regression introduced here.
 *
 * A no-op (rather than a second dialog) while one is already open — see
 * `dialogOpen`'s doc comment for why the backdrop alone doesn't cover this.
 */
export function showConfirmDialog(options: ConfirmDialogOptions): void {
  if (dialogOpen) return;
  dialogOpen = true;

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
    dialogOpen = false;
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

  // Defensive: if the scene shuts down (e.g. `onConfirm` itself calls
  // `scene.start(...)`) before either button is clicked, don't leave
  // `dialogOpen` latched `true` forever — nothing would ever clear it, and
  // every future `showConfirmDialog` call (even from a different scene)
  // would silently no-op.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    dialogOpen = false;
  });
}
