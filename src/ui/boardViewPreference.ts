import { rememberedChoice } from './rememberedChoice';

/** Which board view the player has chosen, remembered like the language
 * (`i18n/index.ts`): in `localStorage`, with the in-memory value kept when
 * storage is unavailable. Not part of a save (§64 B4). */
export type BoardViewKind = 'standard' | 'drawn';

export const BOARD_VIEW_STORAGE_KEY = 'heraklios.boardView';

/** `'drawn'` only for exactly `'drawn'`; anything else (null, unknown, other case) is Standard. */
export function resolveBoardView(stored: string | null | undefined): BoardViewKind {
  return stored === 'drawn' ? 'drawn' : 'standard';
}

const stored = rememberedChoice(BOARD_VIEW_STORAGE_KEY, resolveBoardView);

export function boardViewKind(): BoardViewKind {
  return stored.get();
}

/** Sets and remembers the view. If storage is unavailable the choice still holds for the session. */
export function setBoardViewKind(kind: BoardViewKind): void {
  stored.set(kind);
}

/** Forgets the in-memory choice so the next read goes to storage again (tests). */
export function resetBoardViewForTests(): void {
  stored.reset();
}
