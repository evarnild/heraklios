import type Phaser from 'phaser';
import { messages } from './i18n';
import { setBoardViewKind } from './boardViewPreference';
import type { BoardViewKind } from './boardViewPreference';

/** What the board surface offers the toggle (`MapView` implements it). */
export interface ViewSwitchable {
  readonly viewKind: BoardViewKind;
  setViewKind(kind: BoardViewKind): void;
}

/** The label names the view a click switches to. */
export function viewToggleLabel(current: BoardViewKind): string {
  const t = messages().common;
  return current === 'drawn' ? t.switchToStandard : t.switchToDrawn;
}

/** The look the HUD's view and speed buttons share: depth 30, scroll factor 0. */
export function hudToggleButton(scene: Phaser.Scene, x: number, y: number, label: string): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, label, {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#2f4a5a',
      padding: { x: 8, y: 4 },
    })
    .setScrollFactor(0)
    .setDepth(30);
}

/**
 * The Board's and Placement's view toggle: a HUD button (depth 30, scroll
 * factor 0) that flips between the Standard and Drawn views at any moment and
 * remembers the choice. The caller adds it to its `pinUIObjects` list.
 */
export function createViewToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  view: ViewSwitchable,
  onChange?: (kind: BoardViewKind) => void,
): Phaser.GameObjects.Text {
  const button = hudToggleButton(scene, x, y, viewToggleLabel(view.viewKind)).setInteractive({ useHandCursor: true });
  button.on('pointerdown', () => {
    const next: BoardViewKind = view.viewKind === 'drawn' ? 'standard' : 'drawn';
    setBoardViewKind(next);
    view.setViewKind(next);
    button.setText(viewToggleLabel(next));
    onChange?.(next);
  });
  return button;
}
