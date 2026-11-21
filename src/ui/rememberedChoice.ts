/** A player's choice remembered in `localStorage` under `key`, read once and
 * kept in memory, so it still holds for the session when storage is
 * unavailable. `resolve` turns the stored text (null if none or unreadable)
 * into a valid choice. Not part of a save. */
export interface RememberedChoice<T extends string> {
  get(): T;
  /** Sets and remembers the choice. */
  set(value: T): void;
  /** Forgets the in-memory choice so the next read goes to storage again (tests). */
  reset(): void;
}

export function rememberedChoice<T extends string>(key: string, resolve: (stored: string | null) => T): RememberedChoice<T> {
  let current: T | null = null;
  const readStored = (): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  return {
    get() {
      if (current === null) current = resolve(readStored());
      return current;
    },
    set(value) {
      current = value;
      try {
        localStorage.setItem(key, value);
      } catch {
        // Private mode / blocked storage: the in-memory choice is enough.
      }
    },
    reset() {
      current = null;
    },
  };
}
