import Phaser from 'phaser';
import { session } from '../ui/session';
import { armyValue } from '../engine/state';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const { width, height } = this.scale;
    const state = session.gameState!;
    const winner = state.players.find((p) => p.id === state.winnerId);

    this.add
      .text(width / 2, height / 2 - 60, winner ? `${winner.name} wins!` : 'Game over', {
        fontSize: '36px',
        color: '#e8d9b0',
      })
      .setOrigin(0.5);

    state.players.forEach((p, i) => {
      this.add
        .text(width / 2, height / 2 - 10 + i * 26, `${p.name}: ${armyValue(state, p.id)} points remaining`, {
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    });

    const restartBtn = this.add
      .text(width / 2, height / 2 + 140, 'Back to menu', {
        fontSize: '18px',
        color: '#fff',
        backgroundColor: '#2a5a2a',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restartBtn.on('pointerdown', () => this.scene.start('Menu'));
  }
}
