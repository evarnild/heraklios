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

/**
 * The Board's and Placement's view toggle: a HUD button (depth 30, scroll
 * factor 0) that flips between the Standard and Drawn views at any moment and
 * remembers the choice. The caller adds it to its `pinUIObjects` list.
 */
export function createViewToggle(scene: Phaser.Scene, x: number, y: number, view: ViewSwitchable): Phaser.GameObjects.Text {
  const button = scene.add
    .text(x, y, viewToggleLabel(view.viewKind), {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#2f4a5a',
      padding: { x: 8, y: 4 },
    })
    .setScrollFactor(0)
    .setDepth(30)
    .setInteractive({ useHandCursor: true });
  button.on('pointerdown', () => {
    const next: BoardViewKind = view.viewKind === 'drawn' ? 'standard' : 'drawn';
    setBoardViewKind(next);
    view.setViewKind(next);
    button.setText(viewToggleLabel(next));
  });
  return button;
}
