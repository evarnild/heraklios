import Phaser from 'phaser';
import { MapView } from '../ui/MapView';
import { session } from '../ui/session';
import { advancePhase } from '../engine/turnManager';
import { reachableHexes } from '../engine/movement';
import {
  resolveLandAttack,
  checkRangedEligibility,
  resolveElephantStampede,
  isRammingHit,
  resolveNavalBoarding,
  unitAt,
} from '../engine/combat';
import type { ShipTypeId } from '../data/navalRamming';
import { hexDistance } from '../engine/hex';
import { unitType, currentAttack, currentDefense, type Unit } from '../engine/state';
import type { HexCoord } from '../data/map';
import { MAP_TERRAIN } from '../data/map';

const PLAYER_COLORS = ['#ffd54a', '#ff5a5a', '#5ab4ff', '#5aff7a'];

export class BoardScene extends Phaser.Scene {
  private mapView!: MapView;
  private selected: Unit | null = null;
  private attackedThisPhase = new Set<string>();
  private statusText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  constructor() {
    super('Board');
  }

  create(): void {
    const { width, height } = this.scale;
    this.mapView = new MapView(this, width, height);
    this.renderAllUnits();

    this.statusText = this.add
      .text(20, height - 60, '', { fontSize: '16px', color: '#e8d9b0' })
      .setScrollFactor(0)
      .setDepth(30);
    this.logText = this.add
      .text(20, height - 34, '', { fontSize: '13px', color: '#a89878' })
      .setScrollFactor(0)
      .setDepth(30);

    const endBtn = this.add
      .text(width - 150, height - 60, 'End phase', {
        fontSize: '15px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    endBtn.on('pointerdown', () => this.endPhase());

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
      const t = unitType(u);
      this.mapView.setUnitLabel(u.position, t.name.slice(0, 3), PLAYER_COLORS[u.owner] ?? '#fff');
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

    if (!this.selected) {
      if (occupant && occupant.owner === this.activePlayerId()) {
        this.select(occupant);
      }
      return;
    }

    if (state.phase === 'movement') {
      if (occupant === this.selected) {
        this.deselect();
        return;
      }
      if (occupant && occupant.owner === this.activePlayerId()) {
        this.select(occupant);
        return;
      }
      const reachable = reachableHexes(state, this.selected);
      const key = `${hex.q},${hex.r}`;
      if (reachable.has(key) && !occupant) {
        const cost = reachable.get(key)!;
        this.selected.movementLeft -= cost;
        this.selected.position = hex;
        this.renderAllUnits();
        this.deselect();
      }
      return;
    }

    // combat phase
    if (occupant && occupant.owner === this.activePlayerId()) {
      this.select(occupant);
      return;
    }
    if (occupant && occupant.owner !== this.activePlayerId()) {
      this.tryAttack(this.selected, occupant);
    }
  }

  private select(unit: Unit): void {
    this.selected = unit;
    const state = this.state();
    if (state.phase === 'movement') {
      const reachable = reachableHexes(state, unit);
      this.mapView.highlightHexes(Array.from(reachable.keys()).map(parseKey), 0x4aa6ff, 0.35);
    } else {
      const targets = this.validTargets(unit);
      this.mapView.highlightHexes(targets.map((u) => u.position), 0xff5a5a, 0.4);
    }
  }

  private deselect(): void {
    this.selected = null;
    this.mapView.clearHighlights();
  }

  private validTargets(attacker: Unit): Unit[] {
    const state = this.state();
    const t = unitType(attacker);
    return state.units.filter((u) => {
      if (u.destroyed || u.owner === attacker.owner) return false;
      const dist = hexDistance(attacker.position, u.position);
      if (t.domain === 'naval') return dist === 1; // ramming/boarding require adjacency
      return checkRangedEligibility(attacker, dist).canAttack;
    });
  }

  private tryAttack(attacker: Unit, defender: Unit): void {
    if (this.attackedThisPhase.has(attacker.id)) {
      this.log(`${unitType(attacker).name} has already attacked this phase.`);
      return;
    }
    const valid = this.validTargets(attacker).some((u) => u.id === defender.id);
    if (!valid) return;

    const attackerT = unitType(attacker);
    if (attackerT.domain === 'naval') {
      this.navalAttackPrompt(attacker, defender);
      return;
    }

    const dieRoll = 1 + Math.floor(Math.random() * 6);
    const result = resolveLandAttack([attacker], [defender], dieRoll);
    this.attackedThisPhase.add(attacker.id);
    this.applyLandResult(attacker, defender, result, dieRoll);
    this.deselect();
  }

  private applyLandResult(attacker: Unit, defender: Unit, result: string, dieRoll: number): void {
    const state = this.state();
    this.log(`${unitType(attacker).name} vs ${unitType(defender).name}: die ${dieRoll} -> ${result}`);

    const retreatOrStampede = (unit: Unit, awayFrom: Unit) => {
      if (unitType(unit).id === 'elephants') {
        const stampedeDie = 1 + Math.floor(Math.random() * 6);
        const res = resolveElephantStampede(unit, stampedeDie, state.units);
        for (const hit of res.unitsHit) hit.destroyed = true;
        this.log(`Elephant stampede! Hit ${res.unitsHit.length} unit(s).`);
        return;
      }
      const dir = { q: unit.position.q - awayFrom.position.q, r: unit.position.r - awayFrom.position.r };
      const target = { q: unit.position.q + Math.sign(dir.q), r: unit.position.r + Math.sign(dir.r) };
      const onMap = MAP_TERRAIN.has(`${target.q},${target.r}`);
      const occupied = unitAt(state, target);
      if (onMap && !occupied) unit.position = target;
      else unit.destroyed = true; // no legal retreat hex
    };

    switch (result) {
      case 'AE':
        attacker.destroyed = true;
        break;
      case 'DE':
        defender.destroyed = true;
        break;
      case 'EX':
        attacker.destroyed = true;
        defender.destroyed = true;
        break;
      case 'AR':
        retreatOrStampede(attacker, defender);
        break;
      case 'DR':
        retreatOrStampede(defender, attacker);
        break;
    }
    this.renderAllUnits();
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

    const cleanup = () => {
      panel.destroy();
      label.destroy();
      ramBtn.destroy();
      boardBtn.destroy();
    };

    ramBtn.on('pointerdown', () => {
      cleanup();
      this.attackedThisPhase.add(attacker.id);
      const dieRoll = 1 + Math.floor(Math.random() * 6);
      const hit = isRammingHit(attacker.typeId as ShipTypeId, defender.typeId as ShipTypeId, dieRoll);
      this.log(`Ramming attempt: die ${dieRoll} -> ${hit ? 'SUNK!' : 'missed'}`);
      if (hit) defender.destroyed = true;
      this.renderAllUnits();
      this.deselect();
    });

    boardBtn.on('pointerdown', () => {
      cleanup();
      this.attackedThisPhase.add(attacker.id);
      const dieRoll = 1 + Math.floor(Math.random() * 6);
      const result = resolveNavalBoarding(currentAttack(attacker), currentDefense(defender), dieRoll);
      this.log(`Boarding: die ${dieRoll} -> ${result.side ?? 'no effect'} loses ${result.equipmentLoss} equipment`);
      const victim = result.side === 'attacker' ? attacker : result.side === 'defender' ? defender : null;
      if (victim && result.equipmentLoss > 0) {
        victim.equipmentPoints = Math.max(0, (victim.equipmentPoints ?? 0) - result.equipmentLoss);
        if (victim.equipmentPoints <= 0) victim.destroyed = true;
      }
      this.renderAllUnits();
      this.deselect();
    });
  }

  private endPhase(): void {
    this.deselect();
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
