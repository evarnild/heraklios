import Phaser from 'phaser';
import { MapView } from '../ui/MapView';
import { legalDeploymentHexes, legalNavalDeploymentHexes } from '../ui/mapBounds';
import { session, buildPlayers } from '../ui/session';
import { createInitialState } from '../engine/turnManager';
import { History } from '../engine/history';
import { unitCategory } from '../engine/movement';
import type { GameState, Unit } from '../engine/state';
import { getUnitType } from '../data/units';
import { canEnterTerrain } from '../data/terrain';
import { MAP_TERRAIN, hexKey } from '../data/map';
import type { HexCoord } from '../data/map';

interface QueueItem {
  typeId: string;
  remaining: number;
}

/** Everything a placement undo has to put back — the board plus this scene's
 * own placing progress. See engine/history.ts for why this is snapshot-based.
 * Any in-progress ship-facing pick is deliberately NOT part of this: a
 * pending ship is, by definition, not committed to `state` yet — undoing
 * simply cancels it (see `undo`/`redo` below). */
interface PlacementSnapshot {
  state: GameState;
  queue: QueueItem[];
  placedShips: { hex: HexCoord; facing: number }[];
  unitCounter: number;
}

export class PlacementScene extends Phaser.Scene {
  private playerIndex = 0;
  private mapView!: MapView;
  /** Hexes this player may currently place a LAND unit on — the full
   * 3-hex-deep band along their edge, minus any hex too close to another
   * army's already-placed units (see `mapBounds.ts`'s `legalDeploymentHexes`).
   * Computed once in `create`: enemy positions don't change again until the
   * next player's turn starts. */
  private legalLandHexes: HexCoord[] = [];
  /** Same idea as `legalLandHexes`, but for ships: the player's assigned
   * named bay (see `mapBounds.ts`'s `legalNavalDeploymentHexes`), not the
   * land band — a fleet deploys in a specific sea zone, never on land. */
  private legalSeaHexes: HexCoord[] = [];
  /** Which domain's legal-hex set is currently highlighted on the map, so
   * `refreshPlacementHighlight` only re-centers the camera when the player's
   * queue actually crosses from land units to ships or back, not on every
   * single placement. */
  private highlightedDomain: 'land' | 'naval' | null = null;
  private queue: QueueItem[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private unitCounter = 0;
  /** Ships placed so far by the CURRENT player, for the facing-arrow overlay.
   * Reset in `create`: Phaser reuses one scene instance across the
   * player-by-player `scene.start('Placement', ...)` restarts, so field
   * initializers run only once and this would otherwise keep the previous
   * player's ships and redraw their arrows in the new player's color. */
  private placedShips: { hex: HexCoord; facing: number }[] = [];
  private skipBtn!: Phaser.GameObjects.Text;
  private undoBtn!: Phaser.GameObjects.Text;
  private redoBtn!: Phaser.GameObjects.Text;
  /** Scoped to the current player: cleared in `create`, which re-runs on each
   * per-player `scene.start('Placement', ...)`. */
  private history = new History<PlacementSnapshot>();

  // --- Ship-facing choice at deployment (Feature C) ---
  /** A ship the player has clicked a hex for but not yet confirmed — lets
   * them pick its initial facing (reusing the Movement phase's rotate
   * buttons and facing-arrow overlay, see BoardScene's `rotateSelectedShip`)
   * before it's actually added to `state.units`. */
  private pendingShip: { hex: HexCoord; typeId: string; facing: number } | null = null;
  private rotateCCWBtn!: Phaser.GameObjects.Text;
  private rotateCWBtn!: Phaser.GameObjects.Text;
  private confirmShipBtn!: Phaser.GameObjects.Text;
  private cancelShipBtn!: Phaser.GameObjects.Text;

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
    this.pendingShip = null;
    this.history.clear();

    const { width, height } = this.scale;
    const player = session.gameState!.players[this.playerIndex]!;
    const enemyHexes = session.gameState!.units.filter((u) => u.owner !== this.playerIndex).map((u) => u.position);
    this.legalLandHexes = legalDeploymentHexes(player.edge, enemyHexes);
    this.legalSeaHexes = legalNavalDeploymentHexes(player.edge, enemyHexes);
    this.highlightedDomain = null;

    const titleText = this.add
      .text(width / 2, 20, `${player.name} — place your army (edge ${player.edge})`, {
        fontSize: '18px',
        color: '#e8d9b0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);

    this.mapView = new MapView(this, width, height);
    this.mapView.onHexClick = (hex) => this.handleHexClick(hex);

    this.infoText = this.add
      .text(20, height - 40, '', { fontSize: '15px', color: '#ffe08a' })
      .setScrollFactor(0)
      .setDepth(30);

    this.skipBtn = this.add
      .text(width - 140, height - 40, 'Done placing', {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', () => this.finishPlayer());

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

    // --- Ship-facing controls (hidden except while a ship is pending) ---
    this.rotateCCWBtn = this.add
      .text(width / 2 - 90, height - 104, '⟲ Turn', {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.rotateCCWBtn.on('pointerdown', () => this.rotatePendingShip(-1));

    this.rotateCWBtn = this.add
      .text(width / 2 + 90, height - 104, 'Turn ⟳', {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.rotateCWBtn.on('pointerdown', () => this.rotatePendingShip(1));

    this.confirmShipBtn = this.add
      .text(width / 2, height - 104, 'Confirm facing', {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.confirmShipBtn.on('pointerdown', () => this.confirmPendingShip());

    this.cancelShipBtn = this.add
      .text(width / 2, height - 72, 'Cancel', {
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#5a2a2a',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.cancelShipBtn.on('pointerdown', () => this.cancelPendingShip());

    this.input.keyboard?.on('keydown-Z', (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.shiftKey) this.redo();
      else this.undo();
    });
    this.input.keyboard?.on('keydown-Y', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) this.redo();
    });

    this.mapView.pinUIObjects([
      titleText,
      this.infoText,
      this.skipBtn,
      this.undoBtn,
      this.redoBtn,
      this.rotateCCWBtn,
      this.rotateCWBtn,
      this.confirmShipBtn,
      this.cancelShipBtn,
    ]);

    const selection = session.armySelections[this.playerIndex]!;
    this.queue = Object.entries(selection)
      .filter(([, count]) => count > 0)
      .map(([typeId, count]) => ({ typeId, remaining: count }));

    this.refreshPlacementHighlight();
    this.updateInfo();
    this.refreshUndoRedoButtons();
    this.refreshShipControls();
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
    this.refreshPlacementHighlight();
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
    this.mapView.setFacingIndicators(this.shipArrowList());
  }

  private undo(): void {
    // A pending (unconfirmed) ship isn't part of any snapshot — cancel it
    // rather than leave a stale preview arrow pointing at nothing useful.
    this.cancelPendingShip();
    const entry = this.history.undo(this.captureSnapshot());
    if (!entry) return;
    this.restoreSnapshot(entry.payload);
  }

  private redo(): void {
    this.cancelPendingShip();
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
    if (this.pendingShip) {
      const t = getUnitType(this.pendingShip.typeId);
      this.infoText.setText(
        `Placing ${t.name}: pick a facing (⟲/⟳), then "Confirm facing" — or "Cancel" to pick a different hex.`,
      );
      return;
    }
    const item = this.currentItem();
    if (!item) {
      this.infoText.setText('All units placed. Click "Done placing" to continue.');
      return;
    }
    const t = getUnitType(item.typeId);
    this.infoText.setText(`Placing: ${t.name} (${item.remaining} left) — click a highlighted hex`);
  }

  /** The legal-hex set for whatever the queue is currently placing — land
   * band or bay, per `legalLandHexes`/`legalSeaHexes` — or the land set as a
   * harmless default once the queue is empty (nothing more to click there).
   * Land units are further filtered by the same terrain-access rule
   * `engine/movement.ts` uses for movement (`data/terrain.ts`'s
   * `canEnterTerrain`): chariots/cavalry can't stand on a flanc-abrupt hex,
   * and chariots/cavalry/elephants can't stand on a marais hex, even at
   * initial deployment. */
  private currentLegalHexes(): HexCoord[] {
    const item = this.currentItem();
    if (!item) return this.legalLandHexes;
    const t = getUnitType(item.typeId);
    if (t.domain === 'naval') return this.legalSeaHexes;
    const category = unitCategory(item.typeId);
    return this.legalLandHexes.filter((h) => {
      const terrain = MAP_TERRAIN.get(hexKey(h.q, h.r));
      return terrain !== undefined && canEnterTerrain(terrain, category);
    });
  }

  /** Re-highlights the map for the current queue item's domain, re-centering
   * the camera only when the domain actually changed since the last call —
   * e.g. once a player's land units are all placed and the queue moves on to
   * ships, the highlight (and camera) jumps from the land band to the bay. */
  private refreshPlacementHighlight(): void {
    const item = this.currentItem();
    const domain: 'land' | 'naval' = item ? getUnitType(item.typeId).domain : 'land';
    const legal = this.currentLegalHexes();
    this.mapView.highlightHexes(legal, 0x30ff30, 0.35);
    if (domain !== this.highlightedDomain && legal[0]) this.mapView.centerOn(legal[0]);
    this.highlightedDomain = domain;
  }

  // --- Hex click routing ---

  private handleHexClick(hex: HexCoord): void {
    this.tryPlace(hex);
  }

  private tryPlace(hex: HexCoord): void {
    const item = this.currentItem();
    if (!item) return;
    const isLegal = this.currentLegalHexes().some((h) => h.q === hex.q && h.r === hex.r);
    if (!isLegal) return;
    const state = session.gameState!;
    const occupied = state.units.some((u) => !u.destroyed && u.position.q === hex.q && u.position.r === hex.r);
    if (occupied) return;

    const t = getUnitType(item.typeId);
    if (t.domain === 'naval') {
      // Ship facing is chosen before the unit is actually placed (Feature C)
      // — clicking a hex just stages it; re-clicking a different hex while
      // one is already pending simply relocates the preview, keeping
      // whatever facing was already picked.
      this.pendingShip = { hex, typeId: item.typeId, facing: this.pendingShip?.facing ?? 0 };
      this.refreshShipControls();
      this.mapView.setFacingIndicators(this.shipArrowList());
      this.updateInfo();
      return;
    }

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
      equipmentPoints: undefined,
      defendedThisPhase: false,
      destroyed: false,
    };
    state.units.push(unit);
    item.remaining -= 1;
    this.mapView.setUnitMarker(hex, item.typeId, this.playerIndex);
    this.refreshPlacementHighlight();
    this.updateInfo();
    this.refreshUndoRedoButtons();
  }

  // --- Ship-facing choice (Feature C) ---

  /** Combines already-placed ships with the current pending preview (if any)
   * for a single `setFacingIndicators` call — same array shape BoardScene
   * uses for the Movement phase's facing arrows. */
  private shipArrowList(): { hex: HexCoord; facing: number; playerIndex: number }[] {
    const list = this.placedShips.map((s) => ({ ...s, playerIndex: this.playerIndex }));
    if (this.pendingShip) list.push({ ...this.pendingShip, playerIndex: this.playerIndex });
    return list;
  }

  private refreshShipControls(): void {
    const pending = !!this.pendingShip;
    this.rotateCCWBtn.setVisible(pending);
    this.rotateCWBtn.setVisible(pending);
    this.confirmShipBtn.setVisible(pending);
    this.cancelShipBtn.setVisible(pending);
  }

  private rotatePendingShip(direction: 1 | -1): void {
    if (!this.pendingShip) return;
    this.pendingShip.facing = (this.pendingShip.facing + direction + 6) % 6;
    this.mapView.setFacingIndicators(this.shipArrowList());
  }

  private confirmPendingShip(): void {
    const pending = this.pendingShip;
    const item = this.currentItem();
    if (!pending || !item) return;
    const t = getUnitType(pending.typeId);
    this.history.push(this.captureSnapshot(), `Place ${t.name}`);
    const state = session.gameState!;
    const unit: Unit = {
      id: `p${this.playerIndex}u${this.unitCounter++}`,
      owner: this.playerIndex as 0 | 1 | 2 | 3,
      typeId: pending.typeId,
      position: pending.hex,
      movementLeft: t.movement,
      facing: pending.facing,
      equipmentPoints: Math.ceil(t.defense / 5),
      defendedThisPhase: false,
      destroyed: false,
    };
    state.units.push(unit);
    item.remaining -= 1;
    this.mapView.setUnitMarker(pending.hex, pending.typeId, this.playerIndex);
    this.placedShips.push({ hex: pending.hex, facing: pending.facing });
    this.pendingShip = null;
    this.mapView.setFacingIndicators(this.shipArrowList());
    this.refreshShipControls();
    this.refreshPlacementHighlight();
    this.updateInfo();
    this.refreshUndoRedoButtons();
  }

  private cancelPendingShip(): void {
    if (!this.pendingShip) return;
    this.pendingShip = null;
    this.mapView.setFacingIndicators(this.shipArrowList());
    this.refreshShipControls();
    this.updateInfo();
  }

  private finishPlayer(): void {
    this.cancelPendingShip();
    const nextIndex = this.playerIndex + 1;
    this.mapView.clearAllUnitLabels();
    if (nextIndex < session.playerCount) {
      this.scene.start('Placement', { playerIndex: nextIndex });
    } else {
      this.scene.start('Board');
    }
  }
}
