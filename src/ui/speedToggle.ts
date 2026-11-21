import type Phaser from 'phaser';
import { messages } from './i18n';
import { animationSpeed, nextAnimationSpeed, setAnimationSpeed } from './animationSpeed';
import type { AnimationSpeed } from './animationSpeed';
import type { BoardViewKind } from './boardViewPreference';
import { createViewToggle, hudToggleButton } from './viewToggle';
import type { ViewSwitchable } from './viewToggle';

/** The label names the current speed (spec B13). */
export function speedToggleLabel(speed: AnimationSpeed): string {
  return messages().common.animationSpeed[speed];
}

/**
 * The Board's animation speed button (§66): a HUD button (depth 30, scroll
 * factor 0) beside the view toggle. Each click steps Normal, Slow, Off and
 * remembers the choice. It is visible only in the Drawn view (B13), since the
 * Standard view does not animate (B17): the caller passes the view kind it
 * starts in and calls the returned `sync` when the view changes. The caller
 * adds it to its `pinUIObjects` list.
 */
export function createSpeedToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  viewKind: BoardViewKind,
): { button: Phaser.GameObjects.Text; sync(kind: BoardViewKind): void } {
  const button = hudToggleButton(scene, x, y, speedToggleLabel(animationSpeed()));
  button.on('pointerdown', () => {
    const next = nextAnimationSpeed(animationSpeed());
    setAnimationSpeed(next);
    button.setText(speedToggleLabel(next));
  });
  // A hidden button must not take clicks either.
  const sync = (kind: BoardViewKind): void => {
    button.setVisible(kind === 'drawn');
    if (kind === 'drawn') button.setInteractive({ useHandCursor: true });
    else button.disableInteractive();
  };
  sync(viewKind);
  return { button, sync };
}

/**
 * The Board's view toggle and speed button (§66), the speed button one row up
 * and hidden outside the Drawn view; both for the caller's `pinUIObjects`.
 */
export function createViewControls(
  scene: Phaser.Scene,
  x: number,
  y: number,
  view: ViewSwitchable,
): Phaser.GameObjects.Text[] {
  const speed = createSpeedToggle(scene, x, y - 32, view.viewKind);
  return [createViewToggle(scene, x, y, view, speed.sync), speed.button];
}
