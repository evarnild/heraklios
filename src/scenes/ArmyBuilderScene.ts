import Phaser from 'phaser';
import { UNIT_TYPES } from '../data/units';
import { validateArmy, defaultArmySelection, filledCount, ARMY_BUDGET } from '../engine/army';
import { session, resetToMenu } from '../ui/session';
import { skipAiArmySeats } from '../ui/aiSetup';
import { showConfirmDialog } from '../ui/confirmDialog';
import { messages } from '../ui/i18n';
import { formatArmyError } from '../ui/i18n/format';
import { edgeName, unitName } from '../ui/i18n/names';
import {
  armyBottomY,
  armyRowSlot,
  counterDisplaySize,
  counterTextureKey,
} from '../ui/armyBuilderLayout';

export class ArmyBuilderScene extends Phaser.Scene {
  private playerIndex = 0;
  private totalText!: Phaser.GameObjects.Text;
  private errorText!: Phaser.GameObjects.Text;
  private confirmBtn!: Phaser.GameObjects.Text;
  private countTexts: Record<string, Phaser.GameObjects.Text> = {};
  // The `«` / `»` buttons per unit type; refresh() dims them when a click would change nothing.
  private clearBtns: Record<string, Phaser.GameObjects.Text> = {};
  private fillBtns: Record<string, Phaser.GameObjects.Text> = {};

  constructor() {
    super('ArmyBuilder');
  }

  init(data: { playerIndex: number }): void {
    this.playerIndex = data.playerIndex;
  }

  create(): void {
    // AI seats build no army by hand: `skipAiArmySeats` fills each one in
    // with the ready-made default and reports the first seat that still needs
    // a human, so the skipping happens here rather than by restarting this
    // scene from inside its own `create` (see ui/aiSetup.ts).
    const firstHumanSeat = skipAiArmySeats(this.playerIndex);
    if (firstHumanSeat === null) {
      this.scene.start('Placement', { playerIndex: 0 });
      return;
    }
    this.playerIndex = firstHumanSeat;

    const { width } = this.scale;
    const t = messages();
    const playerName = session.playerNames[this.playerIndex]!;
    const edge = session.edges[this.playerIndex]!;

    this.add
      .text(width / 2, 24, t.builder.title(playerName, edgeName(edge)), {
        fontSize: '22px',
        color: '#e8d9b0',
      })
      .setOrigin(0.5);

    this.addAbandonButton();

    const selection = session.armySelections[this.playerIndex]!;

    // Pre-fills the selection with a ready-made 400-point army; the +/-
    // controls below remain fully live afterward, so this is just a
    // starting point the player can still hand-adjust like any other.
    const defaultArmyBtn = this.add
      .text(width - 20, 24, t.builder.useDefault, {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#3a3a55',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    defaultArmyBtn.on('pointerdown', () => {
      const preset = defaultArmySelection();
      for (const unit of UNIT_TYPES) selection[unit.id] = preset[unit.id] ?? 0;
      this.refresh();
    });

    UNIT_TYPES.forEach((unit, i) => this.drawRow(unit, i, selection));

    const bottom = armyBottomY(UNIT_TYPES.length);
    this.totalText = this.add.text(20, bottom.total, '', {
      fontSize: '18px',
      color: '#ffe08a',
    });

    this.errorText = this.add.text(20, bottom.error, '', {
      fontSize: '13px',
      color: '#ff9a9a',
      wordWrap: { width: width - 40 },
    });

    this.confirmBtn = this.add
      .text(width - 20, bottom.confirm, t.builder.confirm, {
        fontSize: '18px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 14, y: 8 },
      })
      // Right-aligned like "Use default army", so a longer label (French) grows leftwards.
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.confirmBtn.on('pointerdown', () => {
      const result = validateArmy(selection);
      if (!result.valid) return;
      const nextIndex = this.playerIndex + 1;
      if (nextIndex < session.playerCount) {
        this.scene.start('ArmyBuilder', { playerIndex: nextIndex });
      } else {
        this.scene.start('Placement', { playerIndex: 0 });
      }
    });

    this.refresh();
  }

  private addAbandonButton(): void {
    const t = messages();
    const abandonBtn = this.add
      .text(20, 24, t.common.abandon, {
        fontSize: '14px',
        color: '#fff',
        backgroundColor: '#5a2a2a',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    abandonBtn.on('pointerdown', () => {
      showConfirmDialog({
        scene: this,
        message: t.common.abandonMessage(t.builder.abandonMessage),
        confirmLabel: t.common.abandon,
        cancelLabel: t.builder.keepBuilding,
        onConfirm: () => {
          resetToMenu();
          this.scene.start('Menu');
        },
      });
    });
  }

  // One unit's row: its counter, name, cost/max and the `«` `-` count `+` `»` controls (§79).
  private drawRow(unit: (typeof UNIT_TYPES)[number], index: number, selection: Record<string, number>): void {
    const t = messages();
    const { x, centreY: y } = armyRowSlot(index);
    // The builder shows the print counter the Standard view draws, in the
    // building player's colour; Menu's preload loaded every colour already.
    const counter = this.add.image(x.counter, y, counterTextureKey(this.playerIndex, unit.id)).setOrigin(0, 0.5);
    const size = counterDisplaySize(counter.width, counter.height);
    counter.setDisplaySize(size.width, size.height);
    this.add.text(x.name, y, unitName(unit.id), { fontSize: '15px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.add
      .text(x.cost, y, t.builder.costAndMax(unit.cost, unit.maxCount), { fontSize: '13px', color: '#a89878' })
      .setOrigin(0, 0.5);

    const rowBtn = { fontSize: '18px', color: '#fff', backgroundColor: '#553', padding: { x: 10, y: 2 } };
    const button = (bx: number, label: string): Phaser.GameObjects.Text =>
      this.add.text(bx, y, label, rowBtn).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    // `«` clears the type, `»` fills it up to what the budget and its maximum allow (§51).
    const clear = button(x.clear, '«');
    const fill = button(x.fill, '»');
    this.clearBtns[unit.id] = clear;
    this.fillBtns[unit.id] = fill;
    clear.on('pointerdown', () => {
      selection[unit.id] = 0;
      this.refresh();
    });
    fill.on('pointerdown', () => {
      selection[unit.id] = filledCount(selection, unit.id);
      this.refresh();
    });

    const minus = button(x.minus, '-');
    this.countTexts[unit.id] = this.add
      .text(x.count, y, String(selection[unit.id] ?? 0), { fontSize: '16px', color: '#fff' })
      .setOrigin(0, 0.5);
    const plus = button(x.plus, '+');
    minus.on('pointerdown', () => {
      selection[unit.id] = Math.max(0, (selection[unit.id] ?? 0) - 1);
      this.refresh();
    });
    plus.on('pointerdown', () => {
      selection[unit.id] = Math.min(unit.maxCount, (selection[unit.id] ?? 0) + 1);
      this.refresh();
    });
  }

  private refresh(): void {
    const selection = session.armySelections[this.playerIndex]!;
    for (const unit of UNIT_TYPES) {
      this.countTexts[unit.id]!.setText(String(selection[unit.id] ?? 0));
      // Dimmed, not disabled: a click on a dimmed button changes nothing anyway.
      this.clearBtns[unit.id]!.setAlpha((selection[unit.id] ?? 0) === 0 ? 0.4 : 1);
      this.fillBtns[unit.id]!.setAlpha(filledCount(selection, unit.id) === (selection[unit.id] ?? 0) ? 0.4 : 1);
    }
    const result = validateArmy(selection);
    this.totalText.setColor(result.valid ? '#ffe08a' : '#ff6a6a');
    this.totalText.setText(messages().builder.total(result.totalCost, ARMY_BUDGET));
    this.errorText.setText(result.errors.map((e) => formatArmyError(e)).join('\n'));
    this.confirmBtn.setAlpha(result.valid ? 1 : 0.4);
  }
}
