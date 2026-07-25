import Phaser from 'phaser';
import { MapView } from '../ui/MapView';
import { session } from '../ui/session';
import { advancePhase } from '../engine/turnManager';
import { reachableHexes, reachableNavalHexes, findRammingContacts, type RammingContact } from '../engine/movement';
import {
  describeLandAttack,
  applyLandCombatResult,
  exchangeSacrificeMeetsThreshold,
  applyExchangeSacrifice,
  canElephantEnterHex,
  legalRetreatHexes,
  pushCandidates,
  retreatUnitTo,
  completePush,
  validTargets,
  commonValidTargets,
  unionValidTargets,
  attackerCanJoin,
  defenderCanJoin,
  resolveNavalBoarding,
  applyRammingResult,
  applyBoardingResult,
  unitAt,
  type LandAttackDetail,
  type LandCombatOutcome,
} from '../engine/combat';
import { directionForDie, hexAdd } from '../engine/hex';
import { History } from '../engine/history';
import { isRammingHitWithBonus, type ShipTypeId } from '../data/navalRamming';
import { unitType, currentAttack, currentDefense, type GameState, type Unit } from '../engine/state';
import type { HexCoord } from '../data/map';

/** Width of the left-hand HUD panel (buttons, phase status, combat log),
 * reserved outside the map's own viewport — see `MapView`'s `leftPanelWidth`. */
const PANEL_WIDTH = 300;

/** A unit still awaiting the owning player's retreat/push/drift choice.
 * `originalHex` is where it stood before any of that — needed for the
 * "attacker may advance into the vacated hex" offer, which only applies
 * when the DEFENDING side retreats (a DR result). */
interface RetreatQueueItem {
  unit: Unit;
  side: 'attacker' | 'defender';
  originalHex: HexCoord;
}

/** The current retreat/push sub-choice awaiting a click:
 * - 'retreat': `unit` retreats to one of `legalHexes`.
 * - 'choosePushTarget': `unit` is boxed in by friendlies; pick which one of
 *   `pushTargets` retreats to make room.
 * - 'pushedRetreat': the chosen `pushed` unit now retreats to one of
 *   `legalHexes` (its own, not `unit`'s) to complete the push.
 * `onDone` fires once the choice is fully resolved — shared by the normal
 * post-combat retreat queue and, mid-drift, a trampled unit's own retreat. */
type RetreatChoice =
  | { kind: 'retreat'; unit: Unit; legalHexes: HexCoord[]; onDone: () => void }
  | { kind: 'choosePushTarget'; unit: Unit; pushTargets: Unit[]; onDone: () => void }
  | { kind: 'pushedRetreat'; unit: Unit; pushed: Unit; legalHexes: HexCoord[]; onDone: () => void };

/** An elephant's "drift" in progress: direction rolled, walking one hex at
 * a time, real combat resolved against anything encountered. `remainingSteps`
 * is a single shared movement budget (the elephant's full movement
 * allowance) that persists across re-rolled directions — being repelled
 * (AR) doesn't reset it, it just rolls a new heading for what's left. */
interface DriftState {
  elephant: Unit;
  direction: HexCoord;
  remainingSteps: number;
  lines: string[];
  onComplete: () => void;
}

/**
 * Everything undo has to put back. `GameState` covers the board itself, but
 * two per-phase bookkeeping sets live outside it and would silently forget
 * that a unit had already attacked or already rammed. Unit *references* can't
 * be stored (a restore clones the state, so the old objects are no longer the
 * ones in play), so the selection is kept as ids and re-resolved on restore.
 */
interface BoardSnapshot {
  state: GameState;
  attackedThisPhase: string[];
  rammedThisTurn: string[];
  attackGroupIds: string[];
  defenderGroupIds: string[];
  selectedId: string | null;
}

export class BoardScene extends Phaser.Scene {
  private mapView!: MapView;
  /** Movement-phase single-unit selection (unrelated to combat grouping). */
  private selected: Unit | null = null;
  private attackGroup: Unit[] = [];
  private defenderGroup: Unit[] = [];
  private attackedThisPhase = new Set<string>();
  /** Non-elephant units still awaiting a retreat/push choice, and elephants
   * still awaiting their drift — see `beginRetreatChoices`. Drained one at a
   * time: `retreatQueue` first, then `driftQueue`. */
  private retreatQueue: RetreatQueueItem[] = [];
  private driftQueue: RetreatQueueItem[] = [];
  private retreatChoice: RetreatChoice | null = null;
  private driftState: DriftState | null = null;
  /** The attacking side from the combat currently driving the queues above —
   * used to offer the advance choice once each defender's retreat/drift
   * settles. */
  private advanceEligibleAttackers: Unit[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private resolveBtn!: Phaser.GameObjects.Text;
  private rotateCCWBtn!: Phaser.GameObjects.Text;
  private rotateCWBtn!: Phaser.GameObjects.Text;
  private ramNowBtn!: Phaser.GameObjects.Text;
  private undoBtn!: Phaser.GameObjects.Text;
  private redoBtn!: Phaser.GameObjects.Text;
  /** Undo/redo history, scoped to the current phase — `endPhase` clears it,
   * and so does any die roll outside test mode (see `rollDie`). */
  private history = new History<BoardSnapshot>();
  /** Ramming opportunities reachable by the currently-selected ship this
   * movement — recomputed on selection and after every move/rotation (see
   * `refreshNavalMovementControls`). A contact with `cost === 0` is
   * available immediately, without moving, via `ramNowBtn`; the rest are
   * highlighted as clickable hexes (see `selectForMovement`). */
  private navalContacts: RammingContact[] = [];
  /** Ships that already declared a ramming attempt this turn — they've
   * committed their move to it (see `declareRam`) and may not also board in
   * the Combat phase that follows. Cleared at the start of each new
   * Movement phase (a fresh turn for whoever's up next). */
  private rammedThisTurn = new Set<string>();

  constructor() {
    super('Board');
  }

  create(): void {
    const { width, height } = this.scale;
    this.mapView = new MapView(this, width, height, PANEL_WIDTH);
    this.renderAllUnits();

    const panelBg = this.add
      .rectangle(0, 0, PANEL_WIDTH, height, 0x120d06, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(25);

    const endBtn = this.add
      .text(PANEL_WIDTH / 2, 24, 'End phase', {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    endBtn.on('pointerdown', () => this.endPhase());

    this.resolveBtn = this.add
      .text(PANEL_WIDTH / 2, 64, 'Resolve attack', {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#5a2a2a',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.resolveBtn.on('pointerdown', () => this.resolveGroupAttack());

    this.rotateCCWBtn = this.add
      .text(76, 96, '⟲ Turn', {
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.rotateCCWBtn.on('pointerdown', () => this.rotateSelectedShip(-1));

    this.rotateCWBtn = this.add
      .text(160, 96, 'Turn ⟳', {
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.rotateCWBtn.on('pointerdown', () => this.rotateSelectedShip(1));

    this.ramNowBtn = this.add
      .text(244, 96, 'Ram!', {
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#802020',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.ramNowBtn.on('pointerdown', () => this.attemptImmediateRam());

    this.undoBtn = this.add
      .text(16, height - 72, '↶ Undo', {
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
        wordWrap: { width: PANEL_WIDTH - 48 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.undoBtn.on('pointerdown', () => this.undo());

    this.redoBtn = this.add
      .text(16, height - 40, '↷ Redo', {
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 8, y: 4 },
        wordWrap: { width: PANEL_WIDTH - 48 },
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

    this.statusText = this.add
      .text(16, 118, '', {
        fontSize: '15px',
        color: '#e8d9b0',
        wordWrap: { width: PANEL_WIDTH - 32 },
      })
      .setScrollFactor(0)
      .setDepth(30);

    this.logText = this.add
      .text(16, 156, '', {
        fontSize: '13px',
        color: '#a89878',
        wordWrap: { width: PANEL_WIDTH - 32 },
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(30);

    this.mapView.pinUIObjects([
      panelBg,
      endBtn,
      this.resolveBtn,
      this.rotateCCWBtn,
      this.rotateCWBtn,
      this.ramNowBtn,
      this.undoBtn,
      this.redoBtn,
      this.statusText,
      this.logText,
    ]);

    this.resetMovementForActivePlayer();
    this.mapView.onHexClick = (hex) => this.onHexClick(hex);
    this.refreshStatus();
    this.refreshUndoRedoButtons();
  }

  private state() {
    return session.gameState!;
  }

  private resetMovementForActivePlayer(): void {
    const state = this.state();
    const player = state.players[state.seatOrder[state.activePlayerIndex]!]!;
    for (const u of state.units) {
      if (!u.destroyed && u.owner === player.id) {
        u.movementLeft = unitType(u).movement;
      }
    }
    this.rammedThisTurn.clear();
  }

  private renderAllUnits(): void {
    this.mapView.clearAllUnitLabels();
    const ships: { hex: HexCoord; facing: number; playerIndex: number }[] = [];
    for (const u of this.state().units) {
      if (u.destroyed) continue;
      this.mapView.setUnitMarker(u.position, u.typeId, u.owner);
      if (unitType(u).domain === 'naval') {
        ships.push({ hex: u.position, facing: u.facing, playerIndex: u.owner });
      }
    }
    this.mapView.setFacingIndicators(ships);
    this.refreshMovementLabel();
  }

  /** Shows/hides the remaining-movement-points label on the currently
   * selected unit — called after selection changes and after any move or
   * rotation that spends movement points, so it stays in sync with both
   * the unit's position and its `movementLeft`. */
  private refreshMovementLabel(): void {
    if (this.selected) {
      this.mapView.showMovementPoints(this.selected.position, this.selected.movementLeft);
    } else {
      this.mapView.hideMovementPoints();
    }
  }

  private activePlayerId(): number {
    const state = this.state();
    return state.seatOrder[state.activePlayerIndex]!;
  }

  // ---------------------------------------------------------------------------
  // Undo / redo
  //
  // Memento-style: the whole game state is snapshotted before each action
  // rather than each action carrying an inverse. State is mutated in place
  // across dozens of sites (and one combat can cascade into retreats, drifts
  // and advances), so restoring a copy is both simpler and far harder to get
  // subtly wrong. See engine/history.ts.
  // ---------------------------------------------------------------------------

  private captureSnapshot(): BoardSnapshot {
    return {
      state: structuredClone(this.state()),
      attackedThisPhase: [...this.attackedThisPhase],
      rammedThisTurn: [...this.rammedThisTurn],
      attackGroupIds: this.attackGroup.map((u) => u.id),
      defenderGroupIds: this.defenderGroup.map((u) => u.id),
      selectedId: this.selected?.id ?? null,
    };
  }

  /** Records the state as it stands *before* `label`'s action is applied. */
  private recordAction(label: string): void {
    this.history.push(this.captureSnapshot(), label);
    this.refreshUndoRedoButtons();
  }

  private restoreSnapshot(snapshot: BoardSnapshot): void {
    const restored = structuredClone(snapshot.state);
    session.gameState = restored;
    const byId = new Map(restored.units.map((u) => [u.id, u]));

    this.attackedThisPhase = new Set(snapshot.attackedThisPhase);
    this.rammedThisTurn = new Set(snapshot.rammedThisTurn);
    const resolve = (ids: string[]): Unit[] =>
      ids.map((id) => byId.get(id)).filter((u): u is Unit => u !== undefined);
    this.attackGroup = resolve(snapshot.attackGroupIds);
    this.defenderGroup = resolve(snapshot.defenderGroupIds);
    this.selected = (snapshot.selectedId !== null ? byId.get(snapshot.selectedId) : undefined) ?? null;

    // Interactive sequences never span a snapshot — undo is refused while one
    // is pending — so these are already empty. Reset them anyway so a restore
    // can never leave a reference to a unit from the discarded state.
    this.retreatQueue = [];
    this.driftQueue = [];
    this.retreatChoice = null;
    this.driftState = null;
    this.advanceEligibleAttackers = [];
    this.advanceOfferQueue = [];
    this.navalContacts = [];

    this.renderAllUnits();
    this.refreshStatus();
    if (this.selected) {
      this.selectForMovement(this.selected); // re-highlights reachable hexes
    } else if (this.attackGroup.length > 0) {
      this.refreshCombatHighlights();
    } else {
      this.clearNavalMovementControls();
      this.mapView.clearHighlights();
    }
    this.refreshUndoRedoButtons();
  }

  private undo(): void {
    if (this.retreatChoice || this.driftState) {
      this.log('Resolve the pending retreat/drift before undoing.');
      return;
    }
    const entry = this.history.undo(this.captureSnapshot());
    if (!entry) {
      this.log('Nothing to undo.');
      return;
    }
    this.restoreSnapshot(entry.payload);
    this.log(`Undone: ${entry.label}`);
  }

  private redo(): void {
    if (this.retreatChoice || this.driftState) {
      this.log('Resolve the pending retreat/drift before redoing.');
      return;
    }
    const entry = this.history.redo(this.captureSnapshot());
    if (!entry) {
      this.log('Nothing to redo.');
      return;
    }
    this.restoreSnapshot(entry.payload);
    this.log(`Redone: ${entry.label}`);
  }

  /**
   * Every die roll in the game goes through here, so the fairness rule has a
   * single enforcement point: outside test mode a rolled die is a commit
   * point and the history is dropped, since undoing past a roll would let a
   * player re-roll a result they didn't like.
   */
  private rollDie(): number {
    if (!session.testMode) {
      this.history.clear();
      this.refreshUndoRedoButtons();
    }
    return 1 + Math.floor(Math.random() * 6);
  }

  private refreshUndoRedoButtons(): void {
    const undoLabel = this.history.undoLabel;
    const redoLabel = this.history.redoLabel;
    this.undoBtn.setText(undoLabel ? `↶ Undo: ${undoLabel}` : '↶ Undo');
    this.redoBtn.setText(redoLabel ? `↷ Redo: ${redoLabel}` : '↷ Redo');
    this.undoBtn.setAlpha(this.history.canUndo ? 1 : 0.4);
    this.redoBtn.setAlpha(this.history.canRedo ? 1 : 0.4);
  }

  private refreshStatus(): void {
    const state = this.state();
    const player = state.players[this.activePlayerId()]!;
    this.statusText.setText(
      `Turn ${state.turnNumber} — ${player.name} — ${state.phase.toUpperCase()} phase`,
    );
    this.resolveBtn.setVisible(state.phase === 'combat');
  }

  private log(message: string): void {
    this.logText.setText(message);
  }

  /** Like `log`, but appends to (rather than replaces) the current drift's
   * narration when one is in progress — so the whole step-by-step story
   * (direction, each hex, each trample) stays visible instead of each line
   * erasing the last. Outside a drift, behaves exactly like `log`. */
  private appendLine(line: string): void {
    if (this.driftState) {
      this.driftState.lines.push(line);
      this.log(this.driftState.lines.join('\n'));
    } else {
      this.log(line);
    }
  }

  private onHexClick(hex: HexCoord): void {
    if (this.retreatChoice) {
      this.handleRetreatChoiceClick(hex);
      return;
    }

    const state = this.state();
    const occupant = unitAt(state, hex);

    if (state.phase === 'movement') {
      if (!this.selected) {
        if (occupant && occupant.owner === this.activePlayerId()) {
          this.selectForMovement(occupant);
        }
        return;
      }
      if (occupant === this.selected) {
        this.deselectMovement();
        return;
      }
      if (occupant && occupant.owner === this.activePlayerId()) {
        this.selectForMovement(occupant);
        return;
      }
      if (occupant) return; // hexes may hold at most one unit
      if (unitType(this.selected).domain === 'naval') {
        this.handleNavalMoveClick(hex);
        return;
      }
      const reachable = reachableHexes(state, this.selected);
      const key = `${hex.q},${hex.r}`;
      if (reachable.has(key)) {
        const cost = reachable.get(key)!;
        this.recordAction(`Move ${unitType(this.selected).name}`);
        this.selected.movementLeft -= cost;
        this.selected.position = hex;
        this.renderAllUnits();
        this.deselectMovement();
      }
      return;
    }

    // combat phase
    if (occupant && occupant.owner === this.activePlayerId()) {
      this.toggleAttacker(occupant);
      return;
    }
    if (occupant && occupant.owner !== this.activePlayerId()) {
      this.toggleDefender(occupant);
    }
  }

  private selectForMovement(unit: Unit): void {
    this.selected = unit;
    this.refreshMovementLabel();
    if (unitType(unit).domain === 'naval') {
      this.refreshNavalMovementControls(unit);
      return;
    }
    this.clearNavalMovementControls();
    const reachable = reachableHexes(this.state(), unit);
    this.mapView.highlightHexes(Array.from(reachable.keys()).map(parseKey), 0x4aa6ff, 0.35);
  }

  /**
   * Recomputes and displays the currently-selected ship's movement options:
   * plain reachable hexes in blue, and any reachable hex from which its bow
   * would point directly at an adjacent enemy ship (a ramming opportunity —
   * see `findRammingContacts`) in orange. If a contact is available without
   * moving at all (the ship is already bow-on to an enemy), `ramNowBtn`
   * lights up instead of requiring a click on the map.
   */
  private refreshNavalMovementControls(ship: Unit): void {
    const state = this.state();
    const reachable = reachableNavalHexes(state, ship);
    this.navalContacts = findRammingContacts(state, ship);
    const ownHexKey = `${ship.position.q},${ship.position.r}`;
    const contactHexKeys = new Set(this.navalContacts.map((c) => `${c.hex.q},${c.hex.r}`).filter((k) => k !== ownHexKey));
    const moveOnlyHexes = Array.from(reachable.keys()).filter((k) => !contactHexKeys.has(k));
    this.mapView.highlightHexGroups([
      { hexes: moveOnlyHexes.map(parseKey), color: 0x4aa6ff, alpha: 0.35 },
      { hexes: Array.from(contactHexKeys).map(parseKey), color: 0xff6a2a, alpha: 0.45 },
    ]);

    const alreadyRammed = this.rammedThisTurn.has(ship.id);
    this.rotateCCWBtn.setVisible(!alreadyRammed);
    this.rotateCWBtn.setVisible(!alreadyRammed);
    const immediateContact = this.navalContacts.find((c) => c.cost === 0);
    this.ramNowBtn.setVisible(!alreadyRammed && !!immediateContact);
  }

  private clearNavalMovementControls(): void {
    this.navalContacts = [];
    this.rotateCCWBtn.setVisible(false);
    this.rotateCWBtn.setVisible(false);
    this.ramNowBtn.setVisible(false);
  }

  /** Rotating a ship's facing costs 1 movement point per 60° step (see
   * `facingRotationCost`) — this handles a single step at a time, either
   * direction, freely interleaved with forward moves. */
  private rotateSelectedShip(direction: 1 | -1): void {
    const ship = this.selected;
    if (!ship || unitType(ship).domain !== 'naval' || this.rammedThisTurn.has(ship.id)) return;
    if (ship.movementLeft < 1) {
      this.log('No movement left to rotate.');
      return;
    }
    this.recordAction(`Turn ${unitType(ship).name}`);
    ship.facing = (ship.facing + direction + 6) % 6;
    ship.movementLeft -= 1;
    this.renderAllUnits();
    this.refreshNavalMovementControls(ship);
  }

  /** A ram declared without moving — the selected ship is already bow-on
   * to an adjacent enemy ship, per `navalContacts`' cost-0 entry. */
  private attemptImmediateRam(): void {
    const ship = this.selected;
    if (!ship) return;
    const contact = this.navalContacts.find((c) => c.cost === 0);
    if (!contact) return;
    this.promptRam(ship, contact.target, contact.bonus);
  }

  /** Executes a click on a naval unit's reachable-hex/contact highlight
   * during the Movement phase. A contact hex (see `navalContacts`) always
   * takes priority over a plain move to the same hex, since it's the more
   * specific (facing-exact) option — ending the move there always offers
   * the ramming prompt rather than silently sailing past. */
  private handleNavalMoveClick(hex: HexCoord): void {
    const ship = this.selected!;
    const state = this.state();
    const contact = this.navalContacts
      .filter((c) => c.hex.q === hex.q && c.hex.r === hex.r)
      .sort((a, b) => a.cost - b.cost)[0];
    if (contact) {
      this.recordAction(`Move ${unitType(ship).name} into contact`);
      ship.movementLeft -= contact.cost;
      ship.position = contact.hex;
      ship.facing = contact.facing;
      this.renderAllUnits();
      this.promptRam(ship, contact.target, contact.bonus);
      return;
    }
    const key = `${hex.q},${hex.r}`;
    const dest = reachableNavalHexes(state, ship).get(key);
    if (!dest) return;
    this.recordAction(`Move ${unitType(ship).name}`);
    ship.movementLeft -= dest.cost;
    ship.position = hex;
    ship.facing = dest.facing;
    this.renderAllUnits();
    this.refreshNavalMovementControls(ship);
  }

  /** Ramming is a Movement-phase event ("une tentative d'éperonnage a lieu
   * quand, au cours de sa phase de déplacement, un vaisseau rencontre sur
   * sa trajectoire un vaisseau ennemi"), unlike boarding which waits for
   * the Combat phase. Declaring a ram — hit or miss — commits the rest of
   * the ship's movement to the attempt and rules it out of boarding later
   * this same turn. */
  private promptRam(attacker: Unit, defender: Unit, bonus: 0 | 1 | 2): void {
    const { width, height } = this.scale;
    const panel = this.add.rectangle(width / 2, height / 2, 280, 130, 0x1a1408, 0.95).setScrollFactor(0).setDepth(20);
    const label = this.add
      .text(width / 2, height / 2 - 40, `Ram ${unitType(defender).name}?\n(bonus +${bonus})`, {
        fontSize: '14px',
        color: '#fff',
        align: 'center',
        wordWrap: { width: 240 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);
    const yesBtn = this.add
      .text(width / 2 - 60, height / 2 + 25, 'Ram!', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#802020',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    const noBtn = this.add
      .text(width / 2 + 60, height / 2 + 25, 'Hold off', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    this.mapView.excludeFromMainCamera([panel, label, yesBtn, noBtn]);
    const cleanup = () => {
      panel.destroy();
      label.destroy();
      yesBtn.destroy();
      noBtn.destroy();
    };

    yesBtn.on('pointerdown', () => {
      cleanup();
      this.recordAction(`Ram ${unitType(defender).name}`);
      const dieRoll = this.rollDie();
      const hit = isRammingHitWithBonus(attacker.typeId as ShipTypeId, defender.typeId as ShipTypeId, bonus, dieRoll);
      applyRammingResult(defender, hit);
      this.rammedThisTurn.add(attacker.id);
      attacker.movementLeft = 0;
      this.log(`Ramming attempt (bonus +${bonus}): die ${dieRoll} -> ${hit ? 'SUNK!' : 'missed'}`);
      this.renderAllUnits();
      this.deselectMovement();
    });
    noBtn.on('pointerdown', () => {
      cleanup();
      if (this.selected && this.selected.id === attacker.id) {
        this.refreshNavalMovementControls(attacker);
      }
    });
  }

  private deselectMovement(): void {
    this.selected = null;
    this.clearNavalMovementControls();
    this.mapView.clearHighlights();
    this.refreshMovementLabel();
  }

  private toggleAttacker(unit: Unit): void {
    if (this.attackedThisPhase.has(unit.id)) {
      this.log(`${unitType(unit).name} has already attacked this phase.`);
      return;
    }
    const idx = this.attackGroup.findIndex((u) => u.id === unit.id);
    if (idx >= 0) {
      this.recordAction(`Deselect ${unitType(unit).name}`);
      this.attackGroup.splice(idx, 1);
      this.refreshCombatHighlights();
      return;
    }

    const candidateT = unitType(unit);
    const groupIsNaval = this.attackGroup.length > 0 && unitType(this.attackGroup[0]!).domain === 'naval';
    if (candidateT.domain === 'naval' || groupIsNaval) {
      if (this.rammedThisTurn.has(unit.id)) {
        this.log(`${candidateT.name} already rammed this turn and can't also board.`);
        return;
      }
      // Boarding is inherently one ship vs one ship — no combining.
      this.recordAction(`Select ${candidateT.name}`);
      this.attackGroup = [unit];
      this.defenderGroup = [];
      this.refreshCombatHighlights();
      return;
    }

    const state = this.state();
    if (!attackerCanJoin(state, unit, this.defenderGroup, state.combatMode)) {
      this.log(`${candidateT.name} can't reach the current target(s).`);
      return;
    }
    if (this.defenderGroup.length === 0 && state.combatMode === 'single-defender') {
      // No target chosen yet: still require the whole group to share at
      // least one common reachable target, so it never becomes unresolvable.
      if (commonValidTargets(state, [...this.attackGroup, unit]).length === 0) {
        this.log(`${candidateT.name} has no eligible target in common with the current group.`);
        return;
      }
    }
    this.recordAction(`Select ${candidateT.name}`);
    this.attackGroup.push(unit);
    this.refreshCombatHighlights();
  }

  private toggleDefender(unit: Unit): void {
    if (this.attackGroup.length === 0) return;
    if (unit.defendedThisPhase) {
      this.log(`${unitType(unit).name} has already been attacked this phase.`);
      return;
    }
    const idx = this.defenderGroup.findIndex((u) => u.id === unit.id);
    if (idx >= 0) {
      this.recordAction(`Untarget ${unitType(unit).name}`);
      this.defenderGroup.splice(idx, 1);
      this.refreshCombatHighlights();
      return;
    }

    const state = this.state();
    const attackerT = unitType(this.attackGroup[0]!);
    if (attackerT.domain === 'naval') {
      if (!validTargets(state, this.attackGroup[0]!).some((u) => u.id === unit.id)) {
        this.log(`${unitType(unit).name} isn't adjacent with a parallel facing — not a legal boarding target.`);
        return;
      }
      this.navalAttackPrompt(this.attackGroup[0]!, unit);
      return;
    }

    if (state.combatMode === 'single-defender' && this.defenderGroup.length >= 1) {
      this.log('Single-defender mode: only one target per attack — resolve or deselect it first.');
      return;
    }
    if (!defenderCanJoin(state, unit, this.attackGroup, state.combatMode)) {
      this.log(`${unitType(unit).name} isn't reachable by the current attack group.`);
      return;
    }
    this.recordAction(`Target ${unitType(unit).name}`);
    this.defenderGroup.push(unit);
    this.refreshCombatHighlights();
  }

  private refreshCombatHighlights(): void {
    const state = this.state();
    const eligible =
      this.attackGroup.length === 0
        ? []
        : state.combatMode === 'single-defender'
          ? commonValidTargets(state, this.attackGroup)
          : unionValidTargets(state, this.attackGroup);
    const eligibleNotChosen = eligible.filter((u) => !this.defenderGroup.some((d) => d.id === u.id));
    this.mapView.highlightHexGroups([
      { hexes: this.attackGroup.map((u) => u.position), color: 0x4aa6ff, alpha: 0.45 },
      { hexes: eligibleNotChosen.map((u) => u.position), color: 0xffb020, alpha: 0.35 },
      { hexes: this.defenderGroup.map((u) => u.position), color: 0xff3030, alpha: 0.45 },
    ]);
  }

  private clearCombatSelection(): void {
    this.attackGroup = [];
    this.defenderGroup = [];
    this.mapView.clearHighlights();
  }

  /** Kicks off the player-choice queues for units forced to retreat (AR/DR):
   * non-elephants via `retreatQueue`, elephants (which drift instead) via
   * `driftQueue`, non-elephants first. `attackersForAdvance` is only used
   * when `side === 'defender'` — see `promptAdvanceChoice`. */
  private beginRetreatChoices(
    pendingRetreats: Unit[],
    pendingDrifts: Unit[],
    side: 'attacker' | 'defender',
    attackersForAdvance: Unit[],
  ): void {
    this.advanceEligibleAttackers = attackersForAdvance;
    this.retreatQueue = pendingRetreats.map((unit) => ({ unit, side, originalHex: { ...unit.position } }));
    this.driftQueue = pendingDrifts.map((unit) => ({ unit, side, originalHex: { ...unit.position } }));
    this.advanceRetreatQueue();
  }

  private advanceRetreatQueue(): void {
    const item = this.retreatQueue.shift();
    if (item) {
      if (item.unit.destroyed) {
        this.advanceRetreatQueue();
        return;
      }
      this.beginUnitRetreatChoice(item.unit, () => this.finishQueueItem(item));
      return;
    }

    const driftItem = this.driftQueue.shift();
    if (driftItem) {
      if (driftItem.unit.destroyed) {
        this.advanceRetreatQueue();
        return;
      }
      this.beginDrift(driftItem.unit, unitType(driftItem.unit).movement, () => this.finishQueueItem(driftItem));
      return;
    }

    this.retreatChoice = null;
    this.mapView.clearHighlights();
  }

  /** Called once a queued unit's retreat/push/drift is fully settled. Per
   * the rulebook, only when the DEFENDING side retreats does the attacker
   * get the option to advance into the hex it vacated. */
  private finishQueueItem(item: RetreatQueueItem): void {
    if (item.side === 'defender') {
      this.promptAdvanceChoice(item.originalHex, () => this.advanceRetreatQueue());
      return;
    }
    this.advanceRetreatQueue();
  }

  /** Resolves a single unit's retreat: a legal hex to move to, or (if boxed
   * in by friendlies) a push, or elimination if neither is available. Calls
   * `onDone` once fully resolved. Shared by the normal post-combat retreat
   * queue and, mid-drift, a unit the elephant tramples into. */
  private beginUnitRetreatChoice(unit: Unit, onDone: () => void): void {
    const state = this.state();
    const legalHexes = legalRetreatHexes(state, unit);
    if (legalHexes.length > 0) {
      this.retreatChoice = { kind: 'retreat', unit, legalHexes, onDone };
      this.mapView.highlightHexes(legalHexes, 0x4aa6ff, 0.5);
      this.appendLine(`${unitType(unit).name} must retreat — click a highlighted hex.`);
      return;
    }

    const pushTargets = pushCandidates(state, unit);
    if (pushTargets.length > 0) {
      this.retreatChoice = { kind: 'choosePushTarget', unit, pushTargets, onDone };
      this.mapView.highlightHexes(pushTargets.map((u) => u.position), 0xffb020, 0.5);
      this.appendLine(
        `${unitType(unit).name} is surrounded by friendly units — click one to retreat and make room.`,
      );
      return;
    }

    // applyLandCombatResult already eliminates units with no options before
    // queuing them; this only guards against an earlier choice in the same
    // batch changing the board in a way that removes this unit's options too.
    unit.destroyed = true;
    this.appendLine(`${unitType(unit).name} had nowhere to retreat and was eliminated.`);
    this.renderAllUnits();
    onDone();
  }

  private handleRetreatChoiceClick(hex: HexCoord): void {
    const choice = this.retreatChoice;
    if (!choice) return;

    if (choice.kind === 'retreat') {
      const match = choice.legalHexes.find((h) => h.q === hex.q && h.r === hex.r);
      if (!match) return;
      retreatUnitTo(choice.unit, match);
      this.appendLine(`${unitType(choice.unit).name} retreats.`);
      this.renderAllUnits();
      const onDone = choice.onDone;
      this.retreatChoice = null;
      onDone();
      return;
    }

    if (choice.kind === 'choosePushTarget') {
      const occupant = unitAt(this.state(), hex);
      const pushed = occupant && choice.pushTargets.some((u) => u.id === occupant.id) ? occupant : null;
      if (!pushed) return;
      const legalHexes = legalRetreatHexes(this.state(), pushed);
      this.retreatChoice = { kind: 'pushedRetreat', unit: choice.unit, pushed, legalHexes, onDone: choice.onDone };
      this.mapView.highlightHexes(legalHexes, 0x4aa6ff, 0.5);
      this.appendLine(`${unitType(pushed).name} must retreat to make room — click a highlighted hex.`);
      return;
    }

    // choice.kind === 'pushedRetreat'
    const match = choice.legalHexes.find((h) => h.q === hex.q && h.r === hex.r);
    if (!match) return;
    completePush(choice.unit, choice.pushed, match);
    this.appendLine(`${unitType(choice.pushed).name} retreats, making room for ${unitType(choice.unit).name}.`);
    this.renderAllUnits();
    const onDone = choice.onDone;
    this.retreatChoice = null;
    onDone();
  }

  /**
   * Kicks off (or, after a re-roll, continues) an elephant's drift: rolls a
   * direction, then walks it one hex at a time via `stepDrift`.
   * `remainingSteps` is the movement budget shared across any re-rolls
   * within this same drift (being repelled doesn't refill it — see
   * `resolveDriftHit`'s 'AR' case). `existingLines` carries the narration
   * across a re-roll so it reads as one continuous event. `forbiddenDirection`
   * (only meaningful for a freshly-triggered drift, not its own re-rolls)
   * excludes heading straight back at the elephant that just trampled this
   * one — re-rolling until a different direction comes up keeps the other
   * 5 directions equally likely.
   */
  private beginDrift(
    elephant: Unit,
    remainingSteps: number,
    onComplete: () => void,
    existingLines?: string[],
    forbiddenDirection?: HexCoord,
  ): void {
    if (elephant.destroyed || remainingSteps <= 0) {
      onComplete();
      return;
    }
    const lines = existingLines ?? [`${unitType(elephant).name} is forced to retreat — instead it drifts!`];
    let dieRoll: number;
    let direction: HexCoord;
    do {
      dieRoll = this.rollDie();
      direction = directionForDie(dieRoll);
    } while (forbiddenDirection && direction.q === forbiddenDirection.q && direction.r === forbiddenDirection.r);
    this.driftState = { elephant, direction, remainingSteps, lines, onComplete };
    this.appendLine(`Direction die: ${dieRoll} — ${remainingSteps} hex(es) of movement to go.`);
    this.stepDrift();
  }

  private stepDrift(): void {
    const drift = this.driftState;
    if (!drift) return;
    const { elephant } = drift;

    if (elephant.destroyed) {
      this.finishDrift();
      return;
    }
    if (drift.remainingSteps <= 0) {
      this.appendLine(`${unitType(elephant).name} has used up its movement and stops drifting.`);
      this.finishDrift();
      return;
    }

    const nextHex = hexAdd(elephant.position, drift.direction);

    if (!canElephantEnterHex(nextHex)) {
      this.appendLine(`${unitType(elephant).name} drifts off the map or into the sea and is eliminated!`);
      elephant.destroyed = true;
      this.finishDrift();
      return;
    }

    const occupant = unitAt(this.state(), nextHex);
    if (!occupant) {
      elephant.position = nextHex;
      drift.remainingSteps -= 1;
      this.appendLine(`${unitType(elephant).name} moves to (${nextHex.q}, ${nextHex.r}).`);
      this.renderAllUnits();
      this.stepDrift();
      return;
    }

    this.resolveDriftHit(drift, nextHex, occupant);
  }

  /** A drifting elephant reaching an occupied hex: a real combat (elephant
   * as attacker, occupant as defender), same engine as any other attack. */
  private resolveDriftHit(drift: DriftState, hex: HexCoord, occupant: Unit): void {
    const { elephant } = drift;
    const state = this.state();
    const dieRoll = this.rollDie();
    const detail = describeLandAttack([elephant], [occupant], dieRoll);
    const combatOutcome = applyLandCombatResult(state, [elephant], [occupant], detail.result);

    const dieLine =
      detail.terrainModifier !== 0
        ? `die ${detail.rawDieRoll} +${detail.terrainModifier} terrain = ${detail.modifiedDieRoll}`
        : `die ${detail.rawDieRoll}`;
    this.appendLine(
      `${unitType(elephant).name} tramples into ${unitType(occupant).name} at (${hex.q}, ${hex.r}): ` +
        `${detail.attackForce} vs ${detail.defenseForce} (${detail.ratioLabel.replace('-', ':')}), ${dieLine} ` +
        `-> ${BoardScene.RESULT_LABELS[detail.result] ?? detail.result}`,
    );

    switch (detail.result) {
      case 'AE':
      case 'EX':
        this.appendLine(`${unitType(elephant).name} is destroyed.`);
        this.finishDrift();
        return;
      case 'AR': {
        this.appendLine(`${unitType(elephant).name} is repelled and must drift again!`);
        const remaining = drift.remainingSteps;
        const onComplete = drift.onComplete;
        const lines = drift.lines;
        this.driftState = null;
        this.beginDrift(elephant, remaining, onComplete, lines);
        return;
      }
      case 'DE':
        elephant.position = hex;
        drift.remainingSteps -= 1;
        this.renderAllUnits();
        this.stepDrift();
        return;
      case 'DR': {
        const continueAfterVacated = () => {
          this.driftState = drift; // restore — a nested choice/drift may have taken over
          elephant.position = hex;
          drift.remainingSteps -= 1;
          this.renderAllUnits();
          this.stepDrift();
        };
        const trampledElephant = combatOutcome.pendingDrifts.find((u) => u.id === occupant.id);
        const trampledOther = combatOutcome.pendingRetreats.find((u) => u.id === occupant.id);
        if (trampledElephant) {
          // Can't drift straight back at the elephant that just trampled it.
          const forbiddenDirection = { q: -drift.direction.q, r: -drift.direction.r };
          this.beginDrift(occupant, unitType(occupant).movement, continueAfterVacated, undefined, forbiddenDirection);
        } else if (trampledOther) {
          this.beginUnitRetreatChoice(occupant, continueAfterVacated);
        } else {
          continueAfterVacated(); // no legal retreat/push for it — already eliminated
        }
        return;
      }
    }
  }

  private finishDrift(): void {
    const drift = this.driftState;
    if (!drift) return;
    this.renderAllUnits();
    const onComplete = drift.onComplete;
    this.driftState = null;
    onComplete();
  }

  /** Hexes still awaiting an advance-or-not offer — used when defenders are
   * eliminated (DE/EX) rather than retreating, since several can vacate at
   * once with no retreat/push choice in between. Processed one at a time,
   * same as `retreatQueue`, so an earlier advance can't be offered twice. */
  private advanceOfferQueue: HexCoord[] = [];

  private beginAdvanceOffers(vacatedHexes: HexCoord[], attackers: Unit[]): void {
    this.advanceEligibleAttackers = attackers;
    this.advanceOfferQueue = [...vacatedHexes];
    this.processNextAdvanceOffer();
  }

  private processNextAdvanceOffer(): void {
    const hex = this.advanceOfferQueue.shift();
    if (!hex) return;
    this.promptAdvanceChoice(hex, () => this.processNextAdvanceOffer());
  }

  /**
   * "Whenever a combat forces a retreat, the attacker may optionally
   * advance into the hex the defender vacated" — extended here to also
   * cover a defender being eliminated outright (DE/EX), since that frees
   * the hex just as plainly. Offers one button per still-living attacker
   * from the combat that triggered this, plus a decline option; at most
   * one may move in (only one unit can occupy the hex). Calls `onDone`
   * once the choice (or non-choice) is made.
   */
  private promptAdvanceChoice(vacatedHex: HexCoord, onDone: () => void): void {
    if (unitAt(this.state(), vacatedHex)) {
      // Something else already occupies it (e.g. re-pushed into by a later
      // choice in this same batch) — nothing to offer.
      onDone();
      return;
    }
    const candidates = this.advanceEligibleAttackers.filter((u) => !u.destroyed);
    if (candidates.length === 0) {
      onDone();
      return;
    }

    const { width, height } = this.scale;
    const rowHeight = 26;
    const panelHeight = 76 + candidates.length * rowHeight;
    const panelY = height / 2;
    const top = panelY - panelHeight / 2;

    const panel = this.add
      .rectangle(width / 2, panelY, 320, panelHeight, 0x1a1408, 0.97)
      .setScrollFactor(0)
      .setDepth(20);
    const title = this.add
      .text(width / 2, top + 20, 'Advance into the vacated hex?', {
        fontSize: '13px',
        color: '#fff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);

    const buttons: Phaser.GameObjects.Text[] = [];
    const cleanup = () => {
      panel.destroy();
      title.destroy();
      for (const b of buttons) b.destroy();
    };

    candidates.forEach((unit, i) => {
      const btn = this.add
        .text(width / 2, top + 48 + i * rowHeight, `Advance ${unitType(unit).name}`, {
          fontSize: '13px',
          color: '#fff',
          backgroundColor: '#553',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(21)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        cleanup();
        unit.position = vacatedHex;
        this.log(`${unitType(unit).name} advances into the vacated hex.`);
        this.renderAllUnits();
        onDone();
      });
      buttons.push(btn);
    });

    const declineBtn = this.add
      .text(width / 2, top + panelHeight - 20, "Don't advance", {
        fontSize: '13px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    declineBtn.on('pointerdown', () => {
      cleanup();
      onDone();
    });
    buttons.push(declineBtn);

    this.mapView.excludeFromMainCamera([panel, title, ...buttons]);
  }

  private resolveGroupAttack(): void {
    if (this.retreatChoice || this.driftState) {
      this.log('Resolve the pending retreat/drift before starting a new attack.');
      return;
    }
    const state = this.state();
    if (state.phase !== 'combat') return;
    if (this.attackGroup.length === 0) {
      this.log('Select at least one attacking unit first.');
      return;
    }
    if (unitType(this.attackGroup[0]!).domain === 'naval') {
      this.log('Naval attacks resolve immediately when you pick a target.');
      return;
    }
    if (this.defenderGroup.length === 0) {
      this.log('Select at least one target.');
      return;
    }

    this.recordAction(
      `Attack with ${this.attackGroup.length} unit(s)`,
    );
    const dieRoll = this.rollDie();
    const detail = describeLandAttack(this.attackGroup, this.defenderGroup, dieRoll);
    const attackersFromThisCombat = [...this.attackGroup];
    // Defenders keep their `.position` when destroyed (only `.destroyed`
    // flips), but capture it explicitly before resolving for clarity.
    const originalDefenderHexById = new Map(this.defenderGroup.map((d) => [d.id, { ...d.position }]));
    for (const u of this.attackGroup) this.attackedThisPhase.add(u.id);
    const outcome = applyLandCombatResult(state, this.attackGroup, this.defenderGroup, detail.result);
    this.logCombatOutcome(this.attackGroup, this.defenderGroup, detail);

    if (outcome.requiresExchangeChoice) {
      this.promptExchangeSacrifice(
        this.attackGroup,
        outcome.requiredSacrificeForce,
        [...originalDefenderHexById.values()],
      );
      return;
    }
    this.renderAllUnits();
    this.clearCombatSelection();

    if (outcome.pendingRetreats.length > 0 || outcome.pendingDrifts.length > 0) {
      const side = detail.result === 'DR' ? 'defender' : 'attacker';
      this.beginRetreatChoices(outcome.pendingRetreats, outcome.pendingDrifts, side, attackersFromThisCombat);
    } else if (detail.result === 'DE' || detail.result === 'EX') {
      // The defender(s) were eliminated outright rather than retreating —
      // per the same "advance into the vacated hex" option, extended here
      // to cover elimination too, since that frees the hex just as plainly.
      this.beginAdvanceOffers([...originalDefenderHexById.values()], attackersFromThisCombat);
    }
  }

  private static readonly RESULT_LABELS: Record<string, string> = {
    AE: 'AE — Attaquant Éliminé (attacker destroyed)',
    AR: 'AR — Attaquant Recule (attacker retreats)',
    DE: 'DE — Défense Éliminée (defender destroyed)',
    DR: 'DR — Défense Recule (defender retreats)',
    EX: 'EX — Échange (exchange)',
  };

  private logCombatOutcome(attackers: Unit[], defenders: Unit[], detail: LandAttackDetail): void {
    const unitLines = (units: Unit[], statFn: (u: Unit) => number, label: string) =>
      units.map((u) => `  ${unitType(u).name} (${label} ${statFn(u)})`).join('\n');

    const clampedDie = Math.min(6, Math.max(1, detail.modifiedDieRoll));
    const dieLine =
      detail.terrainModifier !== 0
        ? `Die: ${detail.rawDieRoll} + ${detail.terrainModifier} terrain = ${detail.modifiedDieRoll}`
        : `Die: ${detail.rawDieRoll}`;

    const lines = [
      `ATTACKERS (total ${detail.attackForce}):`,
      unitLines(attackers, currentAttack, 'atk'),
      `DEFENDERS (total ${detail.defenseForce}):`,
      unitLines(defenders, currentDefense, 'def'),
      `Ratio: ${detail.ratioLabel.replace('-', ':')}`,
      dieLine + (clampedDie !== detail.modifiedDieRoll ? ` (used ${clampedDie})` : ''),
      `Result: ${BoardScene.RESULT_LABELS[detail.result] ?? detail.result}`,
    ];

    this.log(lines.join('\n'));
  }

  /** On an EX (exchange) result with more than one attacking unit, the
   * attacking player must choose which of their own units to also lose,
   * totaling at least the defenders' force (see `applyLandCombatResult`).
   * `defenderHexes` are the (now-vacated, since EX always destroys the
   * defenders) hexes to offer the surviving attackers an advance into
   * afterward. */
  private promptExchangeSacrifice(attackers: Unit[], requiredForce: number, defenderHexes: HexCoord[]): void {
    const { width, height } = this.scale;
    const rowHeight = 24;
    const panelHeight = 110 + attackers.length * rowHeight;
    const panelY = height / 2;
    const top = panelY - panelHeight / 2;

    const panel = this.add
      .rectangle(width / 2, panelY, 340, panelHeight, 0x1a1408, 0.97)
      .setScrollFactor(0)
      .setDepth(20);
    const title = this.add
      .text(width / 2, top + 20, `Exchange: choose losses\n(need ≥ ${requiredForce} attack force)`, {
        fontSize: '13px',
        color: '#fff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);
    const totalText = this.add
      .text(width / 2, top + panelHeight - 44, '', { fontSize: '13px', color: '#e8d9b0' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);
    const confirmBtn = this.add
      .text(width / 2, top + panelHeight - 16, 'Confirm losses', {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#553',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });

    const selected = new Set<string>();
    const label = (u: Unit) => `${selected.has(u.id) ? '☒' : '☐'} ${unitType(u).name} (atk ${currentAttack(u)})`;
    const updateTotal = () => {
      const chosen = attackers.filter((u) => selected.has(u.id));
      const sum = chosen.reduce((s, u) => s + currentAttack(u), 0);
      const met = exchangeSacrificeMeetsThreshold(chosen, requiredForce);
      totalText.setText(`Selected force: ${sum} / ${requiredForce}${met ? ' ✓' : ''}`);
      confirmBtn.setStyle({ backgroundColor: met ? '#2a5a2a' : '#553' });
    };

    const rowTexts: Phaser.GameObjects.Text[] = attackers.map((unit, i) => {
      const rowText = this.add
        .text(width / 2, top + 56 + i * rowHeight, label(unit), {
          fontSize: '13px',
          color: '#e8d9b0',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(21)
        .setInteractive({ useHandCursor: true });
      rowText.on('pointerdown', () => {
        if (selected.has(unit.id)) selected.delete(unit.id);
        else selected.add(unit.id);
        rowText.setText(label(unit));
        rowText.setColor(selected.has(unit.id) ? '#ff8080' : '#e8d9b0');
        updateTotal();
      });
      return rowText;
    });

    updateTotal();
    this.mapView.excludeFromMainCamera([panel, title, totalText, confirmBtn, ...rowTexts]);

    confirmBtn.on('pointerdown', () => {
      const chosen = attackers.filter((u) => selected.has(u.id));
      if (!exchangeSacrificeMeetsThreshold(chosen, requiredForce)) {
        this.log(`Select units totaling at least ${requiredForce} attack force before confirming.`);
        return;
      }
      applyExchangeSacrifice(chosen);
      panel.destroy();
      title.destroy();
      totalText.destroy();
      confirmBtn.destroy();
      for (const t of rowTexts) t.destroy();
      this.log(`Exchange: defender(s) destroyed; sacrificed ${chosen.map((u) => unitType(u).name).join(', ') || 'none'}.`);
      this.renderAllUnits();
      this.clearCombatSelection();
      this.beginAdvanceOffers(
        defenderHexes,
        attackers.filter((u) => !u.destroyed),
      );
    });
  }

  /** Boarding is the only naval option left by the Combat phase — ramming
   * is resolved during the Movement phase instead (see `promptRam`), as a
   * direct consequence of a ship's path bringing it bow-on to an enemy. */
  private navalAttackPrompt(attacker: Unit, defender: Unit): void {
    const { width, height } = this.scale;
    const panel = this.add.rectangle(width / 2, height / 2, 260, 120, 0x1a1408, 0.95).setScrollFactor(0).setDepth(20);
    const label = this.add
      .text(width / 2, height / 2 - 35, `Board ${unitType(defender).name}?\n${unitType(attacker).name} vs ${unitType(defender).name}`, {
        fontSize: '13px',
        color: '#fff',
        align: 'center',
        wordWrap: { width: 230 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);
    const boardBtn = this.add
      .text(width / 2 - 55, height / 2 + 20, 'Board!', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#553',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    const cancelBtn = this.add
      .text(width / 2 + 55, height / 2 + 20, 'Cancel', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });

    this.mapView.excludeFromMainCamera([panel, label, boardBtn, cancelBtn]);

    const cleanup = () => {
      panel.destroy();
      label.destroy();
      boardBtn.destroy();
      cancelBtn.destroy();
    };

    boardBtn.on('pointerdown', () => {
      cleanup();
      this.recordAction(`Board ${unitType(defender).name}`);
      this.attackedThisPhase.add(attacker.id);
      const dieRoll = this.rollDie();
      const result = resolveNavalBoarding(currentAttack(attacker), currentDefense(defender), dieRoll);
      applyBoardingResult(attacker, defender, result);
      this.log(`Boarding: die ${dieRoll} -> ${result.side ?? 'no effect'} loses ${result.equipmentLoss} equipment`);
      this.renderAllUnits();
      this.clearCombatSelection();
    });
    cancelBtn.on('pointerdown', () => {
      cleanup();
      this.defenderGroup = [];
      this.refreshCombatHighlights();
    });
  }

  private endPhase(): void {
    if (this.retreatChoice || this.driftState) {
      this.log('Resolve the pending retreat/drift before ending the phase.');
      return;
    }
    this.deselectMovement();
    this.clearCombatSelection();
    // Undo reaches back only within the current phase: rewinding across the
    // handoff would let one player rewrite another's committed turn.
    this.history.clear();
    this.refreshUndoRedoButtons();
    const state = this.state();
    advancePhase(state);
    this.attackedThisPhase.clear();
    if (state.gameOver) {
      this.scene.start('GameOver');
      return;
    }
    if (state.phase === 'movement') {
      this.resetMovementForActivePlayer();
    }
    this.refreshStatus();
    this.log('');
  }
}

function parseKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q: q!, r: r! };
}
