import Phaser from 'phaser';
import { MapView } from '../ui/MapView';
import { session } from '../ui/session';
import { advancePhase } from '../engine/turnManager';
import { reachableHexes } from '../engine/movement';
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
  isRammingHit,
  resolveNavalBoarding,
  unitAt,
  type LandAttackDetail,
  type LandCombatOutcome,
} from '../engine/combat';
import { directionForDie, hexAdd } from '../engine/hex';
import type { ShipTypeId } from '../data/navalRamming';
import { unitType, currentAttack, currentDefense, type Unit } from '../engine/state';
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

    this.statusText = this.add
      .text(16, 112, '', {
        fontSize: '15px',
        color: '#e8d9b0',
        wordWrap: { width: PANEL_WIDTH - 32 },
      })
      .setScrollFactor(0)
      .setDepth(30);

    this.logText = this.add
      .text(16, 150, '', {
        fontSize: '13px',
        color: '#a89878',
        wordWrap: { width: PANEL_WIDTH - 32 },
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(30);

    this.mapView.pinUIObjects([panelBg, endBtn, this.resolveBtn, this.statusText, this.logText]);

    this.resetMovementForActivePlayer();
    this.mapView.onHexClick = (hex) => this.onHexClick(hex);
    this.refreshStatus();
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
  }

  private renderAllUnits(): void {
    this.mapView.clearAllUnitLabels();
    for (const u of this.state().units) {
      if (u.destroyed) continue;
      this.mapView.setUnitMarker(u.position, u.typeId, u.owner);
    }
  }

  private activePlayerId(): number {
    const state = this.state();
    return state.seatOrder[state.activePlayerIndex]!;
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
      const reachable = reachableHexes(state, this.selected);
      const key = `${hex.q},${hex.r}`;
      if (reachable.has(key) && !occupant) {
        const cost = reachable.get(key)!;
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
    const reachable = reachableHexes(this.state(), unit);
    this.mapView.highlightHexes(Array.from(reachable.keys()).map(parseKey), 0x4aa6ff, 0.35);
  }

  private deselectMovement(): void {
    this.selected = null;
    this.mapView.clearHighlights();
  }

  private toggleAttacker(unit: Unit): void {
    if (this.attackedThisPhase.has(unit.id)) {
      this.log(`${unitType(unit).name} has already attacked this phase.`);
      return;
    }
    const idx = this.attackGroup.findIndex((u) => u.id === unit.id);
    if (idx >= 0) {
      this.attackGroup.splice(idx, 1);
      this.refreshCombatHighlights();
      return;
    }

    const candidateT = unitType(unit);
    const groupIsNaval = this.attackGroup.length > 0 && unitType(this.attackGroup[0]!).domain === 'naval';
    if (candidateT.domain === 'naval' || groupIsNaval) {
      // Ramming/boarding is inherently one ship vs one ship — no combining.
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
      this.defenderGroup.splice(idx, 1);
      this.refreshCombatHighlights();
      return;
    }

    const state = this.state();
    const attackerT = unitType(this.attackGroup[0]!);
    if (attackerT.domain === 'naval') {
      if (!validTargets(state, this.attackGroup[0]!).some((u) => u.id === unit.id)) {
        this.log(`${unitType(unit).name} isn't in ramming/boarding range.`);
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
      dieRoll = 1 + Math.floor(Math.random() * 6);
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
    const dieRoll = 1 + Math.floor(Math.random() * 6);
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

    const dieRoll = 1 + Math.floor(Math.random() * 6);
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

  private navalAttackPrompt(attacker: Unit, defender: Unit): void {
    const { width, height } = this.scale;
    const panel = this.add.rectangle(width / 2, height / 2, 260, 120, 0x1a1408, 0.95).setScrollFactor(0).setDepth(20);
    const label = this.add
      .text(width / 2, height / 2 - 35, `${unitType(attacker).name} vs ${unitType(defender).name}`, {
        fontSize: '14px',
        color: '#fff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);
    const ramBtn = this.add
      .text(width / 2 - 60, height / 2 + 10, 'Ram', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#553',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    const boardBtn = this.add
      .text(width / 2 + 60, height / 2 + 10, 'Board', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#553',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });

    this.mapView.excludeFromMainCamera([panel, label, ramBtn, boardBtn]);

    const cleanup = () => {
      panel.destroy();
      label.destroy();
      ramBtn.destroy();
      boardBtn.destroy();
    };

    ramBtn.on('pointerdown', () => {
      cleanup();
      this.attackedThisPhase.add(attacker.id);
      defender.defendedThisPhase = true;
      const dieRoll = 1 + Math.floor(Math.random() * 6);
      const hit = isRammingHit(attacker.typeId as ShipTypeId, defender.typeId as ShipTypeId, dieRoll);
      this.log(`Ramming attempt: die ${dieRoll} -> ${hit ? 'SUNK!' : 'missed'}`);
      if (hit) defender.destroyed = true;
      this.renderAllUnits();
      this.clearCombatSelection();
    });

    boardBtn.on('pointerdown', () => {
      cleanup();
      this.attackedThisPhase.add(attacker.id);
      defender.defendedThisPhase = true;
      const dieRoll = 1 + Math.floor(Math.random() * 6);
      const result = resolveNavalBoarding(currentAttack(attacker), currentDefense(defender), dieRoll);
      this.log(`Boarding: die ${dieRoll} -> ${result.side ?? 'no effect'} loses ${result.equipmentLoss} equipment`);
      const victim = result.side === 'attacker' ? attacker : result.side === 'defender' ? defender : null;
      if (victim && result.equipmentLoss > 0) {
        victim.equipmentPoints = Math.max(0, (victim.equipmentPoints ?? 0) - result.equipmentLoss);
        if (victim.equipmentPoints <= 0) victim.destroyed = true;
      }
      this.renderAllUnits();
      this.clearCombatSelection();
    });
  }

  private endPhase(): void {
    if (this.retreatChoice || this.driftState) {
      this.log('Resolve the pending retreat/drift before ending the phase.');
      return;
    }
    this.deselectMovement();
    this.clearCombatSelection();
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
