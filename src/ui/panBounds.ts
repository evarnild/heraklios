// §88 (B5): the camera's pan bounds. Today's bounds are the board's own box
// plus a slack of `padding`; when the room (the camera's width at zoom 1) is
// wider than that, the horizontal bounds widen to the room's width, centred
// on the board, so a board that fits sits in the middle instead of against
// the left edge. Vertical bounds never change. Pure, so it is unit-tested.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `board` is the hex-centre box in world pixels; `roomWidth` the camera's width. */
export function panBounds(board: Box, roomWidth: number, padding: number): Box {
  const y = board.y - padding;
  const height = board.height + padding * 2;
  if (roomWidth > board.width + padding * 2) {
    return { x: board.x + board.width / 2 - roomWidth / 2, y, width: roomWidth, height };
  }
  return { x: board.x - padding, y, width: board.width + padding * 2, height };
}
