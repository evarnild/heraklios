import Phaser from 'phaser';
import type { HexCoord } from '../data/map';
import { drawFacingArrowhead, hexPolygonPointsAt, toVec } from './hexDraw';
import { HEX_SIZE } from './hexRender';
import type { ViewHost } from './boardView';

/**
 * The Drawn view's overlays, at the Standard view's depths: highlight fills
 * (5), rings (11), the drift arrow (12), the movement points (12) and the
 * choice and range labels (13). Restyled for the landscape: a highlight is
 * a fill plus a 2 px outline, so it stays legible over grass, sea and
 * plateau alike.
 */
export class DrawnOverlays {
  private fills: Phaser.GameObjects.Graphics;
  private rings: Phaser.GameObjects.Graphics;
  private drift: Phaser.GameObjects.Graphics;
  private movementLabel: Phaser.GameObjects.Text | null = null;
  private choiceLabels: Phaser.GameObjects.Text[] = [];
  private rangeLabels: Phaser.GameObjects.Text[] = [];

  constructor(private host: ViewHost) {
    const scene = host.scene;
    this.fills = scene.add.graphics().setDepth(5);
    this.rings = scene.add.graphics().setDepth(11);
    this.drift = scene.add.graphics().setDepth(12);
  }

  /** Every world object owned right now (the lazily made labels included). */
  objects(): Phaser.GameObjects.GameObject[] {
    const labels = this.movementLabel ? [this.movementLabel] : [];
    return [this.fills, this.rings, this.drift, ...labels, ...this.choiceLabels, ...this.rangeLabels];
  }

  highlightGroups(groups: { hexes: HexCoord[]; color: number; alpha?: number }[]): void {
    this.fills.clear();
    this.rings.clear();
    for (const { hexes, color, alpha = 0.45 } of groups) {
      for (const hex of hexes) {
        const points = toVec(hexPolygonPointsAt(this.host.toScreen(hex)));
        this.fills.fillStyle(color, alpha);
        this.fills.fillPoints(points, true);
        this.fills.lineStyle(2, color, Math.min(1, alpha + 0.4));
        this.fills.strokePoints(points, true);
      }
    }
  }

  addRings(hexes: HexCoord[], color: number): void {
    this.rings.lineStyle(4, color, 1);
    for (const hex of hexes) this.rings.strokePoints(toVec(hexPolygonPointsAt(this.host.toScreen(hex))), true);
  }

  clearHighlights(): void {
    this.fills.clear();
    this.rings.clear();
  }

  showMovementPoints(hex: HexCoord, value: number): void {
    const center = this.host.toScreen(hex);
    const text = Number.isInteger(value) ? `${value}` : value.toFixed(1);
    if (this.movementLabel) {
      this.movementLabel.setPosition(center.x, center.y).setText(text).setVisible(true);
      return;
    }
    this.movementLabel = this.host.scene.add
      .text(center.x, center.y, text, { fontSize: '18px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(12);
    this.host.ignoreOnUiCamera(this.movementLabel);
  }

  hideMovementPoints(): void {
    this.movementLabel?.setVisible(false);
  }

  setDriftArrow(hex: HexCoord, facing: number, colorHex: string): void {
    this.drift.clear();
    drawFacingArrowhead(this.drift, this.host.toScreen(hex), facing, colorHex, 1.15);
  }

  clearDriftArrow(): void {
    this.drift.clear();
  }

  setChoiceLabels(labels: readonly { hex: HexCoord; text: string }[]): void {
    this.clearChoiceLabels();
    for (const { hex, text } of labels) {
      const c = this.host.toScreen(hex);
      const badge = this.host.scene.add
        .text(c.x - HEX_SIZE * 0.5, c.y - HEX_SIZE * 0.5, text, {
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#1a1408',
          backgroundColor: '#ffcc44',
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(13);
      this.host.ignoreOnUiCamera(badge);
      this.choiceLabels.push(badge);
    }
  }

  clearChoiceLabels(): void {
    for (const badge of this.choiceLabels) badge.destroy();
    this.choiceLabels = [];
  }

  setRangeLabels(labels: readonly { hex: HexCoord; value: number }[]): void {
    this.clearRangeLabels();
    for (const { hex, value } of labels) {
      const c = this.host.toScreen(hex);
      const badge = this.host.scene.add
        .text(c.x + HEX_SIZE * 0.5, c.y + HEX_SIZE * 0.5, `${value}`, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#1a1408b0',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(13);
      this.host.ignoreOnUiCamera(badge);
      this.rangeLabels.push(badge);
    }
  }

  clearRangeLabels(): void {
    for (const badge of this.rangeLabels) badge.destroy();
    this.rangeLabels = [];
  }

  destroy(): void {
    this.clearChoiceLabels();
    this.clearRangeLabels();
    this.movementLabel?.destroy();
    this.movementLabel = null;
    for (const g of [this.fills, this.rings, this.drift]) g.destroy();
  }
}
