import type Phaser from 'phaser';
import { onceEach } from './onceEach';

type Keyboard = Phaser.Input.Keyboard.KeyboardPlugin | null | undefined;

/**
 * Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo. Each handler runs
 * at most once per key event (§62, see `onceEach`).
 */
export function bindUndoRedoKeys(keyboard: Keyboard, actions: { undo: () => void; redo: () => void }): void {
  keyboard?.on(
    'keydown-Z',
    onceEach((event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.shiftKey) actions.redo();
      else actions.undo();
    }),
  );
  keyboard?.on(
    'keydown-Y',
    onceEach((event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) actions.redo();
    }),
  );
}

/** Registers `fn` for a key event name such as `keydown-SPACE`, once per key event. */
export function onKeyOnce(keyboard: Keyboard, name: string, fn: () => void): void {
  keyboard?.on(name, onceEach<KeyboardEvent>(() => fn()));
}
