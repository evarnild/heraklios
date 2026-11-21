import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoDeploySnapshot, zoneSnapshot } from '../engine/deploymentSnapshotCases';
import autoFixture from '../engine/fixtures/72-auto-deploy.json';
import zoneFixture from '../engine/fixtures/72-deployment-zones.json';
import { autoPlaceSeat } from './aiSetup';
import * as mapBounds from './mapBounds';
import { session } from './session';

/**
 * §72: the `ui` deployment surface (`mapBounds`, `autoPlaceSeat`) against the
 * snapshots taken from `main` before the deployment rules moved into the
 * engine. The comparisons import the fixtures statically, so a missing file is
 * a compile error rather than a test that writes its own expectation.
 */

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const placeViaUi = (state: Parameters<typeof autoPlaceSeat>[0], seat: number, selection: Record<string, number>, rng: () => number) => {
  session.armySelections[seat] = selection;
  autoPlaceSeat(state, seat, rng);
};

describe('deployment snapshots, through ui', () => {
  it('mapBounds returns the zones it returned before §72', () => {
    expect(json(zoneSnapshot(mapBounds))).toEqual(zoneFixture);
  });

  it('autoPlaceSeat deploys the units it deployed before §72', () => {
    expect(json(autoDeploySnapshot(placeViaUi))).toEqual(autoFixture);
  });

  // Run once, on the code as it stood before §72, to (re)create the fixtures.
  it.runIf(process.env.HERAKLIOS_WRITE_FIXTURES === '72')('writes the fixtures', () => {
    const dir = new URL('../engine/fixtures/', import.meta.url);
    writeFileSync(new URL('72-deployment-zones.json', dir), JSON.stringify(zoneSnapshot(mapBounds)));
    writeFileSync(new URL('72-auto-deploy.json', dir), JSON.stringify(autoDeploySnapshot(placeViaUi)));
  });
});
