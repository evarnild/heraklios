import type Phaser from 'phaser';
import { messages } from './i18n';
import { animationSpeed, nextAnimationSpeed, setAnimationSpeed } from './animationSpeed';
import type { AnimationSpeed } from './animationSpeed';
import { createViewToggle, hudToggleButton } from './viewToggle';
import type { ViewSwitchable } from './viewToggle';

/** The label names the current speed (§66 B13, §77 B12). */
export function speedToggleLabel(speed: AnimationSpeed): string {
  return messages().common.animationSpeed[speed];
}

/**
 * The Board's animation speed button (§66): a HUD button (depth 30, scroll
 * factor 0) beside the view toggle. Each click steps Normal, Slow, Off and
 * remembers the choice. It is shown in both views (§77 B12, which reverses
 * §66 B13): one stored speed, read by both. The caller adds it to its
 * `pinUIObjects` list.
 */
export function createSpeedToggle(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Text {
  const button = hudToggleButton(scene, x, y, speedToggleLabel(animationSpeed())).setInteractive({ useHandCursor: true });
  button.on('pointerdown', () => {
    const next = nextAnimationSpeed(animationSpeed());
    setAnimationSpeed(next);
    button.setText(speedToggleLabel(next));
  });
  return button;
}

/**
 * The Board's view toggle and speed button (§66, §77), the speed button one
 * row up, shown in both views; both for the caller's `pinUIObjects`.
 */
export function createViewControls(
  scene: Phaser.Scene,
  x: number,
  y: number,
  view: ViewSwitchable,
): Phaser.GameObjects.Text[] {
  return [createViewToggle(scene, x, y, view), createSpeedToggle(scene, x, y - 32)];
}
