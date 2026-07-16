import Phaser from 'phaser';
import { UNIT_TYPES } from '../data/units';
import { validateArmy, ARMY_BUDGET } from '../engine/army';
import { session } from '../ui/session';

export class ArmyBuilderScene extends Phaser.Scene {
  private playerIndex = 0;
  private totalText!: Phaser.GameObjects.Text;
  private countTexts: Record<string, Phaser.GameObjects.Text> = {};

  constructor() {
    super('ArmyBuilder');
  }

  init(data: { playerIndex: number }): void {
    this.playerIndex = data.playerIndex;
  }

  create(): void {
    const { width } = this.scale;
    const playerName = session.playerNames[this.playerIndex]!;
    const edge = session.edges[this.playerIndex]!;

    this.add
      .text(width / 2, 24, `${playerName} — build your army (edge: ${edge})`, {
        fontSize: '22px',
        color: '#e8d9b0',
      })
      .setOrigin(0.5);

    const selection = session.armySelections[this.playerIndex]!;

    const startY = 70;
    const rowH = 32;
    UNIT_TYPES.forEach((unit, i) => {
      const y = startY + i * rowH;
      this.add.text(20, y, unit.name, { fontSize: '15px', color: '#ffffff' });
      this.add.text(220, y, `${unit.cost}pt  (max ${unit.maxCount})`, { fontSize: '13px', color: '#a89878' });

      const minus = this.add
        .text(400, y, '-', { fontSize: '18px', color: '#fff', backgroundColor: '#553', padding: { x: 10, y: 2 } })
        .setInteractive({ useHandCursor: true });
      const countText = this.add.text(430, y, String(selection[unit.id] ?? 0), {
        fontSize: '16px',
        color: '#fff',
      });
      const plus = this.add
        .text(460, y, '+', { fontSize: '18px', color: '#fff', backgroundColor: '#553', padding: { x: 10, y: 2 } })
        .setInteractive({ useHandCursor: true });

      this.countTexts[unit.id] = countText;

      minus.on('pointerdown', () => {
        selection[unit.id] = Math.max(0, (selection[unit.id] ?? 0) - 1);
        this.refresh();
      });
      plus.on('pointerdown', () => {
        selection[unit.id] = Math.min(unit.maxCount, (selection[unit.id] ?? 0) + 1);
        this.refresh();
      });
    });

    this.totalText = this.add.text(20, startY + UNIT_TYPES.length * rowH + 20, '', {
      fontSize: '18px',
      color: '#ffe08a',
    });

    const confirmBtn = this.add
      .text(width - 160, startY + UNIT_TYPES.length * rowH + 20, 'Confirm army', {
        fontSize: '18px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 14, y: 8 },
      })
      .setInteractive({ useHandCursor: true });

    confirmBtn.on('pointerdown', () => {
      const result = validateArmy(selection);
      if (!result.valid) {
        this.totalText.setColor('#ff6a6a');
        return;
      }
      const nextIndex = this.playerIndex + 1;
      if (nextIndex < session.playerCount) {
        this.scene.start('ArmyBuilder', { playerIndex: nextIndex });
      } else {
        this.scene.start('Placement', { playerIndex: 0 });
      }
    });

    this.refresh();
  }

  private refresh(): void {
    const selection = session.armySelections[this.playerIndex]!;
    for (const unit of UNIT_TYPES) {
      this.countTexts[unit.id]!.setText(String(selection[unit.id] ?? 0));
    }
    const result = validateArmy(selection);
    this.totalText.setColor(result.valid ? '#ffe08a' : '#ff6a6a');
    this.totalText.setText(`Total: ${result.totalCost} / ${ARMY_BUDGET}  ${result.errors.join('; ')}`);
  }
}
