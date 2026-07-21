import Phaser from 'phaser';
import { MapView } from '../ui/MapView';
import { deploymentZone } from '../ui/mapBounds';
import { session, buildPlayers } from '../ui/session';
import { createInitialState } from '../engine/turnManager';
import type { Unit } from '../engine/state';
import { getUnitType } from '../data/units';
import type { HexCoord } from '../data/map';

interface QueueItem {
  typeId: string;
  remaining: number;
}

export class PlacementScene extends Phaser.Scene {
  private playerIndex = 0;
  private mapView!: MapView;
  private zone: HexCoord[] = [];
  private queue: QueueItem[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private unitCounter = 0;

  constructor() {
    super('Placement');
  }

  init(data: { playerIndex: number }): void {
    this.playerIndex = data.playerIndex;
  }

  create(): void {
    if (this.playerIndex === 0 || !session.gameState) {
      session.gameState = createInitialState(buildPlayers());
    }

    const { width, height } = this.scale;
    const player = session.gameState!.players[this.playerIndex]!;
    const titleText = this.add
      .text(width / 2, 20, `${player.name} — place your army (edge ${player.edge}, green hexes)`, {
        fontSize: '18px',
        color: '#e8d9b0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);

    this.mapView = new MapView(this, width, height);
    this.zone = deploymentZone(player.edge);
    this.mapView.highlightHexes(this.zone, 0x30ff30, 0.35);
    if (this.zone[0]) this.mapView.centerOn(this.zone[0]);

    const selection = session.armySelections[this.playerIndex]!;
    this.queue = Object.entries(selection)
      .filter(([, count]) => count > 0)
      .map(([typeId, count]) => ({ typeId, remaining: count }));

    this.infoText = this.add
      .text(20, height - 40, '', { fontSize: '15px', color: '#ffe08a' })
      .setScrollFactor(0)
      .setDepth(30);
    this.updateInfo();

    this.mapView.onHexClick = (hex) => this.tryPlace(hex);

    const skipBtn = this.add
      .text(width - 140, height - 40, 'Done placing', {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', () => this.finishPlayer());

    this.mapView.pinUIObjects([titleText, this.infoText, skipBtn]);
  }

  private currentItem(): QueueItem | undefined {
    return this.queue.find((q) => q.remaining > 0);
  }

  private updateInfo(): void {
    const item = this.currentItem();
    if (!item) {
      this.infoText.setText('All units placed. Click "Done placing" to continue.');
      return;
    }
    const t = getUnitType(item.typeId);
    this.infoText.setText(`Placing: ${t.name} (${item.remaining} left) — click a highlighted hex`);
  }

  private tryPlace(hex: HexCoord): void {
    const item = this.currentItem();
    if (!item) return;
    const inZone = this.zone.some((h) => h.q === hex.q && h.r === hex.r);
    if (!inZone) return;
    const state = session.gameState!;
    const occupied = state.units.some((u) => !u.destroyed && u.position.q === hex.q && u.position.r === hex.r);
    if (occupied) return;

    const t = getUnitType(item.typeId);
    const unit: Unit = {
      id: `u${this.unitCounter++}`,
      owner: this.playerIndex as 0 | 1 | 2 | 3,
      typeId: item.typeId,
      position: hex,
      movementLeft: t.movement,
      facing: 0,
      equipmentPoints: t.domain === 'naval' ? Math.ceil(t.defense / 5) : undefined,
      hasRetreatedThisPhase: false,
      destroyed: false,
    };
    state.units.push(unit);
    item.remaining -= 1;
    this.mapView.setUnitMarker(hex, item.typeId, this.playerIndex);
    this.updateInfo();
  }

  private finishPlayer(): void {
    const nextIndex = this.playerIndex + 1;
    this.mapView.clearAllUnitLabels();
    if (nextIndex < session.playerCount) {
      this.scene.start('Placement', { playerIndex: nextIndex });
    } else {
      this.scene.start('Board');
    }
  }
}
