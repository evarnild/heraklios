import type Phaser from 'phaser';
import type { UnitDrawing, ViewHost } from './boardView';
import { drawArrowheadAt } from './hexDraw';
import { HEX_SIZE, PLAYER_COLORS_HEX, facingAngleRad, markerTextureKey } from './hexRender';
import { jointFigure } from './unitLayer';
import type { LayerFigure } from './unitLayer';

/** Depth of a ship's facing mark: over every counter (10), under the hex rings (11), as the one shared arrow layer always drew. */
const MARK_DEPTH = 10.5;
/** §82: the phase marker sits over the facing mark, still under the hex rings (11). */
const STATUS_DEPTH = 10.6;

/**
 * Makes the Standard view's figure for one unit: the physical-counter image
 * (public/markers/), or a coloured text chip if the texture is not loaded,
 * named by the unit id so the dev hook can find it. A ship also gets its
 * facing mark: an arrowhead drawn along +x at the counter's centre and
 * rotated to the facing.
 *
 * The mark belongs to its counter (§77 B6, I1): the joint figure moves, fades
 * and shakes both together, so the mark is never ahead of the counter it
 * marks. Only the mark turns (B7, I2): the counter image is a physical-counter
 * icon that must stay upright for its printed stats to stay readable. Every
 * other decoration (fills, rings, labels, the readout) shows the new state at
 * once (B8, I3).
 */
export function makeStandardFigure(host: ViewHost, unit: UnitDrawing): LayerFigure {
  const scene = host.scene;
  const center = host.toScreen(unit.position);
  const textureKey = markerTextureKey(unit.owner, unit.typeId);
  let counter: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  if (scene.textures.exists(textureKey)) {
    const img = scene.add.image(center.x, center.y, textureKey).setDepth(10);
    const targetWidth = HEX_SIZE * 1.6;
    const scale = targetWidth / img.width;
    img.setDisplaySize(img.width * scale, img.height * scale);
    counter = img;
  } else {
    counter = scene.add
      .text(center.x, center.y, unit.typeId.slice(0, 3).toUpperCase(), {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#1a1408',
        backgroundColor: PLAYER_COLORS_HEX[unit.owner] ?? '#ffffff',
        padding: { x: 4, y: 2 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);
  }
  counter.setName(unit.id);
  let mark: Phaser.GameObjects.Graphics | null = null;
  if (unit.facing !== undefined) {
    mark = scene.add.graphics().setDepth(MARK_DEPTH).setPosition(center.x, center.y);
    drawArrowheadAt(mark, { x: 0, y: 0 }, 0, PLAYER_COLORS_HEX[unit.owner] ?? '#ffffff');
    mark.setRotation(facingAngleRad(unit.facing));
  }
  // Counters made after pinUIObjects ran once at scene setup stay off the fixed HUD camera too.
  const badge = scene.add.graphics().setDepth(STATUS_DEPTH).setPosition(center.x, center.y);
  host.ignoreOnUiCamera(mark ? [counter, mark, badge] : [counter, badge]);
  return jointFigure(counter, mark, badge);
}
