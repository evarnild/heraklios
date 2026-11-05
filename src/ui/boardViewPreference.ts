/** Which board view the player has chosen, remembered like the language
 * (`i18n/index.ts`): in `localStorage`, with the in-memory value kept when
 * storage is unavailable. Not part of a save (§64 B4). */
export type BoardViewKind = 'standard' | 'drawn';

export const BOARD_VIEW_STORAGE_KEY = 'heraklios.boardView';

/** `'drawn'` only for exactly `'drawn'`; anything else (null, unknown, other case) is Standard. */
export function resolveBoardView(stored: string | null | undefined): BoardViewKind {
  return stored === 'drawn' ? 'drawn' : 'standard';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(BOARD_VIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

let current: BoardViewKind | null = null;

export function boardViewKind(): BoardViewKind {
  if (current === null) current = resolveBoardView(readStored());
  return current;
}

/** Sets and remembers the view. If storage is unavailable the choice still holds for the session. */
export function setBoardViewKind(kind: BoardViewKind): void {
  current = kind;
  try {
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, kind);
  } catch {
    // Private mode / blocked storage: the in-memory choice is enough.
  }
}

/** Forgets the in-memory choice so the next read goes to storage again (tests). */
export function resetBoardViewForTests(): void {
  current = null;
}
