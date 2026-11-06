import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_VIEW_STORAGE_KEY,
  boardViewKind,
  resetBoardViewForTests,
  resolveBoardView,
  setBoardViewKind,
} from './boardViewPreference';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('resolveBoardView', () => {
  it('maps exactly "drawn" to drawn', () => {
    expect(resolveBoardView('drawn')).toBe('drawn');
  });
  it('maps everything else to standard', () => {
    for (const v of [null, undefined, '', 'Drawn', 'standard', 'DRAWN', 'x']) expect(resolveBoardView(v)).toBe('standard');
  });
});

describe('the board view store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetBoardViewForTests();
  });

  it('reads the stored choice, standard by default', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [BOARD_VIEW_STORAGE_KEY]: 'drawn' }));
    expect(boardViewKind()).toBe('drawn');
    resetBoardViewForTests();
    vi.stubGlobal('localStorage', fakeStorage());
    expect(boardViewKind()).toBe('standard');
  });

  it('persists a choice under heraklios.boardView and round-trips', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    setBoardViewKind('drawn');
    expect(BOARD_VIEW_STORAGE_KEY).toBe('heraklios.boardView');
    expect(storage.data['heraklios.boardView']).toBe('drawn');
    resetBoardViewForTests();
    expect(boardViewKind()).toBe('drawn');
  });

  it('reads standard from a throwing store and keeps a write in memory', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(boardViewKind()).toBe('standard');
    setBoardViewKind('drawn');
    expect(boardViewKind()).toBe('drawn');
  });
});
