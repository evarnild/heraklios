import { describe, expect, it } from 'vitest';
import { MAP_TERRAIN } from '../data/map';
import { UNIT_TYPES } from '../data/units';
import { canEnterTerrain } from '../data/terrain';
import { unitCategory } from '../engine/state';
import { deploymentBand, navalDeploymentBand } from './mapBounds';
import { session } from './session';
import { startFigureGalleryGame } from './testMode';

describe('startFigureGalleryGame', () => {
  startFigureGalleryGame();
  const units = session.gameState!.units;

  it('lays out all 14 types for all 4 players, once each (56 units)', () => {
    expect(units).toHaveLength(56);
    const pairs = new Set(units.map((u) => `${u.owner}/${u.typeId}`));
    expect(pairs.size).toBe(56);
    for (const owner of [0, 1, 2, 3]) for (const t of UNIT_TYPES) expect(pairs.has(`${owner}/${t.id}`)).toBe(true);
  });

  it('puts no two units on one hex', () => {
    expect(new Set(units.map((u) => `${u.position.q},${u.position.r}`)).size).toBe(56);
  });

  it('puts each unit on a terrain it may enter, in its own player\'s band or bay', () => {
    const edges = session.edges;
    for (const u of units) {
      const terrain = MAP_TERRAIN.get(`${u.position.q},${u.position.r}`)!;
      expect(canEnterTerrain(terrain, unitCategory(u.typeId), u.typeId === 'galeres'), `${u.typeId} on ${terrain}`).toBe(true);
      const naval = UNIT_TYPES.find((t) => t.id === u.typeId)!.domain === 'naval';
      const band = (naval ? navalDeploymentBand : deploymentBand)(edges[u.owner]!);
      expect(band.some((h) => h.q === u.position.q && h.r === u.position.r)).toBe(true);
    }
  });

  it('marks the scenario as the gallery', () => {
    expect(session.testScenario).toBe('gallery');
    expect(session.playerCount).toBe(4);
  });
});
