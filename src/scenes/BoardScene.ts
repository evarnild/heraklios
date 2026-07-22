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
import type { ShipTypeId } from '../data/navalRamming';
import { unitType, currentAttack, currentDefense, type Unit } from '../engine/state';
import type { HexCoord } from '../data/map';

/** Width of the left-hand HUD panel (buttons, phase status, combat log),
 * reserved outside the map's own viewport — see `MapView`'s `leftPanelWidth`. */
const PANEL_WIDTH = 300;

export class BoardScene extends Phaser.Scene {
  private mapView!: MapView;
  /** Movement-phase single-unit selection (unrelated to combat grouping). */
  private selected: Unit | null = null;
  private attackGroup: Unit[] = [];
  private defenderGroup: Unit[] = [];
  private attackedThisPhase = new Set<string>();
  private statusText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

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

    const resolveBtn = this.add
      .text(PANEL_WIDTH / 2, 24, 'Resolve attack', {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#5a2a2a',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    resolveBtn.on('pointerdown', () => this.resolveGroupAttack());

    const endBtn = this.add
      .text(PANEL_WIDTH / 2, 64, 'End phase', {
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

    this.mapView.pinUIObjects([panelBg, resolveBtn, endBtn, this.statusText, this.logText]);

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
  }

  private log(message: string): void {
    this.logText.setText(message);
  }

  private onHexClick(hex: HexCoord): void {
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

  private resolveGroupAttack(): void {
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
    for (const u of this.attackGroup) this.attackedThisPhase.add(u.id);
    const outcome = applyLandCombatResult(state, this.attackGroup, this.defenderGroup, detail.result);
    this.logCombatOutcome(this.attackGroup, this.defenderGroup, detail, outcome);

    if (outcome.requiresExchangeChoice) {
      this.promptExchangeSacrifice(this.attackGroup, outcome.requiredSacrificeForce);
      return;
    }
    this.renderAllUnits();
    this.clearCombatSelection();
  }

  private static readonly RESULT_LABELS: Record<string, string> = {
    AE: 'AE — Attaquant Éliminé (attacker destroyed)',
    AR: 'AR — Attaquant Recule (attacker retreats)',
    DE: 'DE — Défense Éliminée (defender destroyed)',
    DR: 'DR — Défense Recule (defender retreats)',
    EX: 'EX — Échange (exchange)',
  };

  private logCombatOutcome(
    attackers: Unit[],
    defenders: Unit[],
    detail: LandAttackDetail,
    outcome: LandCombatOutcome,
  ): void {
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

    const stampedeHits = outcome.retreats
      .filter((r) => r.stampeded)
      .reduce((sum, r) => sum + r.unitsHit.length, 0);
    if (stampedeHits > 0) lines.push(`Elephant stampede hit ${stampedeHits} unit(s)!`);

    this.log(lines.join('\n'));
  }

  /** On an EX (exchange) result with more than one attacking unit, the
   * attacking player must choose which of their own units to also lose,
   * totaling at least the defenders' force (see `applyLandCombatResult`). */
  private promptExchangeSacrifice(attackers: Unit[], requiredForce: number): void {
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
