/**
 * §67: the Board has a zoomable main camera for the map and a fixed HUD
 * camera for the HUD. A camera ignores an object when the object's
 * `cameraFilter` holds that camera's id bit. Every object should be ignored
 * by exactly one of the two; one ignored by neither is drawn twice (a second
 * copy of a map object over the HUD, say). Pure, so the rule is unit-tested.
 */
export interface CameraObject {
  cameraFilter: number;
  type: string;
  depth: number;
}

export interface CameraStray {
  type: string;
  depth: number;
}

/** The objects both cameras would render. */
export function cameraStrays(objects: readonly CameraObject[], mainId: number, uiId: number): CameraStray[] {
  return objects
    .filter((o) => (o.cameraFilter & mainId) === 0 && (o.cameraFilter & uiId) === 0)
    .map((o) => ({ type: o.type, depth: o.depth }));
}
