import Phaser from 'phaser';
import { session, resetToMenu } from '../ui/session';
import { armyValue } from '../engine/state';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(): void {
    const { width, height } = this.scale;
    const state = session.gameState!;
    // `winnerIds` is 0 (nobody left — full mutual elimination), 1 (an
    // outright win) or 2+ (a draw between that many tied players) — see its
    // doc comment on `GameState`. Only the middle case names a single winner.
    const winners = state.players.filter((p) => state.winnerIds.includes(p.id));
    const headline =
      winners.length === 1
        ? `${winners[0]!.name} wins!`
        : winners.length > 1
          ? `Draw between ${joinNames(winners.map((p) => p.name))}!`
          : 'Game over';

    this.add
      .text(width / 2, height / 2 - 60, headline, {
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
    // The game just ended, so there's nothing destructive to confirm here —
    // but it's the same "returning to the Menu without resetting `session`
    // leaks the finished game's setup into the next one" gap the Abandon
    // controls guard against elsewhere (see `resetToMenu`'s doc comment),
    // and this was the only pre-existing `scene.start('Menu')` in the
    // codebase, so it had the same latent bug.
    restartBtn.on('pointerdown', () => {
      resetToMenu();
      this.scene.start('Menu');
    });
  }
}

/** "A and B" for two names, "A, B and C" for three or more — purely a
 * display nicety for the draw headline above, so it isn't pure/tested
 * elsewhere the way engine formatting helpers are. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
