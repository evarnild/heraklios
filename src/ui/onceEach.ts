/**
 * Wraps an event handler so it runs at most once per event object (§62).
 *
 * Phaser 3.90 re-walks its whole key queue after each event in a frame and
 * re-emits the earlier events' handlers with the same `KeyboardEvent` object,
 * so one press can reach a handler several times. A genuine second press, or
 * a held key's auto-repeat, is a new event object, so identity (not timing or
 * field values) tells a re-emit from a new press. The WeakSet keeps no
 * references to events.
 */
export function onceEach<E extends object>(fn: (event: E) => void): (event: E) => void {
  const seen = new WeakSet<E>();
  return (event: E): void => {
    if (seen.has(event)) return;
    seen.add(event);
    fn(event);
  };
}
