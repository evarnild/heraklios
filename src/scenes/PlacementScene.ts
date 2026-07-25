import Phaser from 'phaser';
import { MapView } from '../ui/MapView';
import { deploymentZone, defaultAnchor, maxAnchor, clampAnchor, zonesAreSeparated } from '../ui/mapBounds';
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
 * own placing progress. See engine/history.ts for why this is snapshot-based.
 * The zone-position choice and any in-progress ship-facing pick are
 * deliberately NOT part of this: the zone is a one-time setup step that
 * happens before any unit is placed (nothing to undo back past), and a
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
  private zone: HexCoord[] = [];
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

  // --- Zone-position step (Feature B) ---
  /** `'zone'` while the player is still choosing where their strip sits;
   * `'placing'` once it's confirmed and unit placement is underway. Edges too
   * short to offer a real choice (`maxAnchor(edge) === 0`) skip straight to
   * `'placing'` with the only possible anchor — see `create`. */
  private phase: 'zone' | 'placing' = 'zone';
  private anchor = 0;
  private zoneTitleText!: Phaser.GameObjects.Text;
  private zoneWarningText!: Phaser.GameObjects.Text;
  private shiftLeftBtn!: Phaser.GameObjects.Text;
  private shiftRightBtn!: Phaser.GameObjects.Text;
  private confirmZoneBtn!: Phaser.GameObjects.Text;

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
    if (this.playerIndex === 0 || session.deploymentZones.length !== session.playerCount) {
      session.deploymentZones = Array.from({ length: session.playerCount }, () => null);
    }
    this.placedShips = [];
    this.pendingShip = null;
    this.history.clear();

    const { width, height } = this.scale;
    const player = session.gameState!.players[this.playerIndex]!;
    this.anchor = defaultAnchor(player.edge);

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

    // --- Zone-position step UI ---
    this.zoneTitleText = this.add
      .text(width / 2, 48, '', { fontSize: '14px', color: '#ffe08a' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);
    this.zoneWarningText = this.add
      .text(width / 2, 68, '', { fontSize: '13px', color: '#ff8080' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);

    this.shiftLeftBtn = this.add
      .text(width / 2 - 160, 96, '◀ Shift', {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.shiftLeftBtn.on('pointerdown', () => this.shiftZone(-1));

    this.shiftRightBtn = this.add
      .text(width / 2 + 160, 96, 'Shift ▶', {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.shiftRightBtn.on('pointerdown', () => this.shiftZone(1));

    this.confirmZoneBtn = this.add
      .text(width / 2, 128, 'Confirm zone', {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.confirmZoneBtn.on('pointerdown', () => this.confirmZone());

    // --- Unit-placement step UI (hidden until the zone is confirmed) ---
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
      this.zoneTitleText,
      this.zoneWarningText,
      this.shiftLeftBtn,
      this.shiftRightBtn,
      this.confirmZoneBtn,
      this.infoText,
      this.skipBtn,
      this.undoBtn,
      this.redoBtn,
      this.rotateCCWBtn,
      this.rotateCWBtn,
      this.confirmShipBtn,
      this.cancelShipBtn,
    ]);

    // An edge too short to offer more than one anchor position isn't a real
    // choice — skip the zone-picking step and go straight to placing units.
    if (maxAnchor(player.edge) === 0) {
      this.lockInZone(this.anchor);
    } else {
      this.enterZonePhase();
    }
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
    this.mapView.setFacingIndicators(this.shipArrowList());
  }

  private undo(): void {
    if (this.phase !== 'placing') return;
    // A pending (unconfirmed) ship isn't part of any snapshot — cancel it
    // rather than leave a stale preview arrow pointing at nothing useful.
    this.cancelPendingShip();
    const entry = this.history.undo(this.captureSnapshot());
    if (!entry) return;
    this.restoreSnapshot(entry.payload);
  }

  private redo(): void {
    if (this.phase !== 'placing') return;
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

  // --- Zone-position step (Feature B) ---

  /** All hexes already locked in by earlier players (this player's own
   * index and any not-yet-placed later players are `null` and skipped) —
   * used both for the warning highlight and the separation check. Placement
   * proceeds strictly in player-index order, so every entry below this
   * player's own index is guaranteed final by the time they reach this step. */
  private priorZones(): HexCoord[] {
    return session.deploymentZones.filter((z): z is HexCoord[] => z !== null).flat();
  }

  private candidateZone(): HexCoord[] {
    const player = session.gameState!.players[this.playerIndex]!;
    return deploymentZone(player.edge, this.anchor);
  }

  /**
   * Whether ANY anchor position on this edge would satisfy the 4-hex
   * separation from earlier players' zones. The rulebook doesn't say what
   * happens if a player's whole edge is boxed in (only realistically
   * possible on a very cramped map, or with more players sharing corners
   * than this game currently allows — see `session.ts`'s edge assignment,
   * which always gives each player a distinct edge). Conservative/literal
   * reading: the separation rule can't be allowed to soft-lock placement, so
   * `confirmZone` falls back to permitting an otherwise-invalid choice only
   * when NO position on the edge would have worked anyway.
   */
  private anyAnchorSatisfiesSeparation(): boolean {
    const player = session.gameState!.players[this.playerIndex]!;
    const prior = this.priorZones();
    if (prior.length === 0) return true;
    for (let a = 0; a <= maxAnchor(player.edge); a++) {
      if (zonesAreSeparated(deploymentZone(player.edge, a), prior, 4)) return true;
    }
    return false;
  }

  private enterZonePhase(): void {
    this.phase = 'zone';
    this.setZonePhaseVisible(true);
    this.setPlacingPhaseVisible(false);
    this.refreshZoneDisplay();
  }

  private setZonePhaseVisible(visible: boolean): void {
    this.zoneTitleText.setVisible(visible);
    this.zoneWarningText.setVisible(visible);
    this.shiftLeftBtn.setVisible(visible);
    this.shiftRightBtn.setVisible(visible);
    this.confirmZoneBtn.setVisible(visible);
  }

  private setPlacingPhaseVisible(visible: boolean): void {
    this.infoText.setVisible(visible);
    this.skipBtn.setVisible(visible);
    this.undoBtn.setVisible(visible);
    this.redoBtn.setVisible(visible);
    // Ship-facing controls stay hidden unless a ship is actually pending —
    // `refreshShipControls` (called right after this) has the final say.
    if (!visible) {
      this.rotateCCWBtn.setVisible(false);
      this.rotateCWBtn.setVisible(false);
      this.confirmShipBtn.setVisible(false);
      this.cancelShipBtn.setVisible(false);
    }
  }

  private shiftZone(direction: 1 | -1): void {
    if (this.phase !== 'zone') return;
    const player = session.gameState!.players[this.playerIndex]!;
    this.anchor = clampAnchor(player.edge, this.anchor + direction);
    this.refreshZoneDisplay();
  }

  private refreshZoneDisplay(): void {
    const player = session.gameState!.players[this.playerIndex]!;
    const candidate = this.candidateZone();
    const prior = this.priorZones();
    const valid = zonesAreSeparated(candidate, prior, 4);

    this.mapView.highlightHexGroups([
      { hexes: candidate, color: valid ? 0xffd700 : 0xff3030, alpha: 0.4 },
      { hexes: prior, color: 0x8a3a3a, alpha: 0.35 },
    ]);
    if (candidate[0]) this.mapView.centerOn(candidate[0]);

    const atStart = this.anchor <= 0;
    const atEnd = this.anchor >= maxAnchor(player.edge);
    this.zoneTitleText.setText(
      `${player.name} — choose where your 3-hex-deep strip sits along edge ${player.edge} (gold)`,
    );
    this.shiftLeftBtn.setAlpha(atStart ? 0.4 : 1);
    this.shiftRightBtn.setAlpha(atEnd ? 0.4 : 1);
    if (prior.length === 0) {
      this.zoneWarningText.setText('');
    } else if (valid) {
      this.zoneWarningText.setText('Clear of other armies (need 4+ hexes of separation).');
      this.zoneWarningText.setColor('#9be89b');
    } else if (this.anyAnchorSatisfiesSeparation()) {
      this.zoneWarningText.setText('Too close to another army’s zone (red) — shift away before confirming.');
      this.zoneWarningText.setColor('#ff8080');
    } else {
      this.zoneWarningText.setText('No position on this edge keeps 4+ hexes from every other army — confirm anyway.');
      this.zoneWarningText.setColor('#ffb060');
    }
    this.confirmZoneBtn.setAlpha(valid || !this.anyAnchorSatisfiesSeparation() ? 1 : 0.5);
  }

  private confirmZone(): void {
    if (this.phase !== 'zone') return;
    const candidate = this.candidateZone();
    const valid = zonesAreSeparated(candidate, this.priorZones(), 4);
    // See `anyAnchorSatisfiesSeparation`'s doc comment: an invalid choice is
    // only let through when nothing on this edge would have been valid.
    if (!valid && this.anyAnchorSatisfiesSeparation()) return;
    this.lockInZone(this.anchor);
  }

  /** Finalizes the deployment zone at `anchor`, records it in `session` for
   * later players' separation checks, and switches to the unit-placement UI. */
  private lockInZone(anchor: number): void {
    const player = session.gameState!.players[this.playerIndex]!;
    this.zone = deploymentZone(player.edge, anchor);
    session.deploymentZones[this.playerIndex] = this.zone;
    this.phase = 'placing';

    const selection = session.armySelections[this.playerIndex]!;
    this.queue = Object.entries(selection)
      .filter(([, count]) => count > 0)
      .map(([typeId, count]) => ({ typeId, remaining: count }));

    this.setZonePhaseVisible(false);
    this.setPlacingPhaseVisible(true);
    this.mapView.highlightHexes(this.zone, 0x30ff30, 0.35);
    if (this.zone[0]) this.mapView.centerOn(this.zone[0]);
    this.updateInfo();
    this.refreshUndoRedoButtons();
    this.refreshShipControls();
  }

  // --- Hex click routing ---

  private handleHexClick(hex: HexCoord): void {
    if (this.phase !== 'placing') return;
    this.tryPlace(hex);
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
    this.rotateCCWBtn.setVisible(this.phase === 'placing' && pending);
    this.rotateCWBtn.setVisible(this.phase === 'placing' && pending);
    this.confirmShipBtn.setVisible(this.phase === 'placing' && pending);
    this.cancelShipBtn.setVisible(this.phase === 'placing' && pending);
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
    if (this.phase !== 'placing') return;
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
