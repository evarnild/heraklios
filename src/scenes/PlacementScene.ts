import Phaser from 'phaser';
import { MapView } from '../ui/MapView';
import { deploymentZone } from '../ui/mapBounds';
import { session, buildPlayers } from '../ui/session';
import { createInitialState } from '../engine/turnManager';
import { History } from '../engine/history';
import type { GameState, Unit } from '../engine/state';
import { getUnitType } from '../data/units';
import type { HexCoord } from '../data/map';

interface QueueItem {
  typeId: string;
  remaining: number;
}

/** Everything a placement undo has to put back — the board plus this scene's
 * own placing progress. See engine/history.ts for why this is snapshot-based. */
interface PlacementSnapshot {
  state: GameState;
  queue: QueueItem[];
  placedShips: { hex: HexCoord; facing: number }[];
  unitCounter: number;
}

export class PlacementScene extends Phaser.Scene {
  private playerIndex = 0;
  private mapView!: MapView;
  private zone: HexCoord[] = [];
  private queue: QueueItem[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private unitCounter = 0;
  /** Ships placed so far by the CURRENT player, for the facing-arrow overlay —
   * all deploy at a fixed default facing (see `Unit.facing`'s doc comment).
   * Reset in `create`: Phaser reuses one scene instance across the
   * player-by-player `scene.start('Placement', ...)` restarts, so field
   * initializers run only once and this would otherwise keep the previous
   * player's ships and redraw their arrows in the new player's color. */
  private placedShips: { hex: HexCoord; facing: number }[] = [];
  private undoBtn!: Phaser.GameObjects.Text;
  private redoBtn!: Phaser.GameObjects.Text;
  /** Scoped to the current player: cleared in `create`, which re-runs on each
   * per-player `scene.start('Placement', ...)`. */
  private history = new History<PlacementSnapshot>();

  constructor() {
    super('Placement');
  }

  init(data: { playerIndex: number }): void {
    this.playerIndex = data.playerIndex;
  }

  create(): void {
    if (this.playerIndex === 0 || !session.gameState) {
      session.gameState = createInitialState(buildPlayers(), session.combatMode, session.randomizedTurnOrder);
    }
    this.placedShips = [];
    this.history.clear();

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

    this.undoBtn = this.add
      .text(20, height - 104, '↶ Undo', {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.undoBtn.on('pointerdown', () => this.undo());

    this.redoBtn = this.add
      .text(20, height - 72, '↷ Redo', {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.redoBtn.on('pointerdown', () => this.redo());

    this.input.keyboard?.on('keydown-Z', (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.shiftKey) this.redo();
      else this.undo();
    });
    this.input.keyboard?.on('keydown-Y', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) this.redo();
    });

    this.refreshUndoRedoButtons();
    this.mapView.pinUIObjects([titleText, this.infoText, skipBtn, this.undoBtn, this.redoBtn]);
  }

  private captureSnapshot(): PlacementSnapshot {
    return {
      state: structuredClone(session.gameState!),
      queue: structuredClone(this.queue),
      placedShips: structuredClone(this.placedShips),
      unitCounter: this.unitCounter,
    };
  }

  private restoreSnapshot(snapshot: PlacementSnapshot): void {
    session.gameState = structuredClone(snapshot.state);
    this.queue = structuredClone(snapshot.queue);
    this.placedShips = structuredClone(snapshot.placedShips);
    this.unitCounter = snapshot.unitCounter;
    this.redrawPlacedUnits();
    this.updateInfo();
    this.refreshUndoRedoButtons();
  }

  /** Rebuilds the marker/arrow overlay from state after a restore. Only this
   * player's units are drawn, matching what `tryPlace` renders as you go. */
  private redrawPlacedUnits(): void {
    this.mapView.clearAllUnitLabels();
    for (const u of session.gameState!.units) {
      if (u.owner === this.playerIndex) this.mapView.setUnitMarker(u.position, u.typeId, this.playerIndex);
    }
    this.mapView.setFacingIndicators(
      this.placedShips.map((s) => ({ ...s, playerIndex: this.playerIndex })),
    );
  }

  private undo(): void {
    const entry = this.history.undo(this.captureSnapshot());
    if (!entry) return;
    this.restoreSnapshot(entry.payload);
  }

  private redo(): void {
    const entry = this.history.redo(this.captureSnapshot());
    if (!entry) return;
    this.restoreSnapshot(entry.payload);
  }

  private refreshUndoRedoButtons(): void {
    const undoLabel = this.history.undoLabel;
    const redoLabel = this.history.redoLabel;
    this.undoBtn.setText(undoLabel ? `↶ Undo: ${undoLabel}` : '↶ Undo');
    this.redoBtn.setText(redoLabel ? `↷ Redo: ${redoLabel}` : '↷ Redo');
    this.undoBtn.setAlpha(this.history.canUndo ? 1 : 0.4);
    this.redoBtn.setAlpha(this.history.canRedo ? 1 : 0.4);
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
    this.history.push(this.captureSnapshot(), `Place ${t.name}`);
    const unit: Unit = {
      // Namespaced by player so ids stay unique without depending on
      // `unitCounter` surviving Phaser's scene restarts (several features key
      // state off unit ids — see engine/history.ts' callers).
      id: `p${this.playerIndex}u${this.unitCounter++}`,
      owner: this.playerIndex as 0 | 1 | 2 | 3,
      typeId: item.typeId,
      position: hex,
      movementLeft: t.movement,
      facing: 0,
      equipmentPoints: t.domain === 'naval' ? Math.ceil(t.defense / 5) : undefined,
      defendedThisPhase: false,
      destroyed: false,
    };
    state.units.push(unit);
    item.remaining -= 1;
    this.mapView.setUnitMarker(hex, item.typeId, this.playerIndex);
    if (t.domain === 'naval') {
      this.placedShips.push({ hex, facing: unit.facing });
      this.mapView.setFacingIndicators(
        this.placedShips.map((s) => ({ ...s, playerIndex: this.playerIndex })),
      );
    }
    this.updateInfo();
    this.refreshUndoRedoButtons();
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
