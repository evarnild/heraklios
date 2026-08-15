import Phaser from 'phaser';
import { session, resetSession, seatControlFor, MAX_PLAYERS } from '../ui/session';
import { nextSeatControl, seatControlLabel } from '../engine/seatControl';
import { startTestGame, startCloseCombatTestGame } from '../ui/testMode';
import { SaveLoadPanel } from '../ui/saveLoadPanel';
import { stagePendingLoad } from '../ui/saveStorage';
import { PLAYER_COLOR_NAMES, markerTextureKey, markerAssetPath } from '../ui/hexRender';
import { UNIT_TYPES } from '../data/units';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  preload(): void {
    // Load every unit-marker counter image once, up front, so later scenes
    // (Placement, Board) can render them immediately with no pop-in.
    for (let playerIndex = 0; playerIndex < PLAYER_COLOR_NAMES.length; playerIndex++) {
      const color = PLAYER_COLOR_NAMES[playerIndex]!;
      for (const unit of UNIT_TYPES) {
        this.load.image(markerTextureKey(playerIndex, unit.id), markerAssetPath(color, unit.id));
      }
    }
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, 80, 'HÉRAKLIOS', { fontSize: '48px', color: '#e8d9b0', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 130, 'Jeux & Stratégie #6 (1980) — digital hotseat edition', {
        fontSize: '16px',
        color: '#a89878',
      })
      .setOrigin(0.5);

    this.add.text(width / 2, 195, 'Number of players', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);

    [2, 3, 4].forEach((count, i) => {
      const btn = this.add
        .text(width / 2 - 100 + i * 100, 240, String(count), {
          fontSize: '28px',
          color: '#ffffff',
          backgroundColor: '#4a3f2a',
          padding: { x: 20, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        resetSession(count);
        this.scene.start('ArmyBuilder', { playerIndex: 0 });
      });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#6a5a3a' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#4a3f2a' }));
    });

    this.add.text(width / 2, 285, 'Combat rule', { fontSize: '16px', color: '#a89878' }).setOrigin(0.5);
    const combatModeLabel = () =>
      session.combatMode === 'multi-defender'
        ? 'Group attacks: several units vs. several units'
        : 'Group attacks: several units vs. one unit (rulebook)';
    const combatModeBtn = this.add
      .text(width / 2, 312, combatModeLabel(), {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#4a3f2a',
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    combatModeBtn.on('pointerdown', () => {
      session.combatMode = session.combatMode === 'multi-defender' ? 'single-defender' : 'multi-defender';
      combatModeBtn.setText(combatModeLabel());
    });
    combatModeBtn.on('pointerover', () => combatModeBtn.setStyle({ backgroundColor: '#6a5a3a' }));
    combatModeBtn.on('pointerout', () => combatModeBtn.setStyle({ backgroundColor: '#4a3f2a' }));

    this.add.text(width / 2, 348, 'Turn order', { fontSize: '16px', color: '#a89878' }).setOrigin(0.5);
    const turnOrderLabel = () =>
      session.randomizedTurnOrder
        ? 'Re-randomized each turn'
        : 'Fixed (initial draw)';
    const turnOrderBtn = this.add
      .text(width / 2, 375, turnOrderLabel(), {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#4a3f2a',
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    turnOrderBtn.on('pointerdown', () => {
      session.randomizedTurnOrder = !session.randomizedTurnOrder;
      turnOrderBtn.setText(turnOrderLabel());
    });
    turnOrderBtn.on('pointerover', () => turnOrderBtn.setStyle({ backgroundColor: '#6a5a3a' }));
    turnOrderBtn.on('pointerout', () => turnOrderBtn.setStyle({ backgroundColor: '#4a3f2a' }));

    // Per-seat Human/AI (plan.md §6.4's Stage 4). All four seats are offered
    // even though only the first `playerCount` of them will exist: the count
    // isn't chosen until the button above is clicked, which also STARTS the
    // game, so there is no later moment to configure this in. Seats past the
    // chosen count are simply ignored (see `seatControlFor`'s callers), and
    // the hint below says so rather than leaving it to be discovered.
    this.add.text(width / 2, 411, 'Who plays each seat', { fontSize: '16px', color: '#a89878' }).setOrigin(0.5);
    this.add
      .text(width / 2, 431, 'Seats beyond the player count you pick are ignored.', {
        fontSize: '11px',
        color: '#7a6c52',
      })
      .setOrigin(0.5);
    const seatButtonColor = (index: number) =>
      seatControlFor(index) === 'human' ? '#4a3f2a' : '#3a4a5a';
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const seatLabel = () => `${session.playerNames[i]}: ${seatControlLabel(seatControlFor(i))}`;
      const btn = this.add
        .text(width / 2 - 240 + i * 160, 458, seatLabel(), {
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: seatButtonColor(i),
          padding: { x: 10, y: 6 },
          fixedWidth: 150,
          align: 'center',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        session.seatControls[i] = nextSeatControl(seatControlFor(i));
        btn.setText(seatLabel());
        btn.setStyle({ backgroundColor: seatButtonColor(i) });
      });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#6a5a3a' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: seatButtonColor(i) }));
    }

    const testBtn = this.add
      .text(width / 2, 510, 'Mode test (2 joueurs, armées prêtes)', {
        fontSize: '16px',
        color: '#cfcfcf',
        backgroundColor: '#333',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    testBtn.on('pointerdown', () => {
      startTestGame();
      this.scene.start('Board');
    });
    testBtn.on('pointerover', () => testBtn.setStyle({ backgroundColor: '#4a4a4a' }));
    testBtn.on('pointerout', () => testBtn.setStyle({ backgroundColor: '#333' }));

    const combatTestBtn = this.add
      .text(width / 2, 552, 'Mode test combat (unités face à face, 2 cases)', {
        fontSize: '16px',
        color: '#cfcfcf',
        backgroundColor: '#333',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    combatTestBtn.on('pointerdown', () => {
      startCloseCombatTestGame();
      this.scene.start('Board');
    });
    combatTestBtn.on('pointerover', () => combatTestBtn.setStyle({ backgroundColor: '#4a4a4a' }));
    combatTestBtn.on('pointerout', () => combatTestBtn.setStyle({ backgroundColor: '#333' }));

    // Always offered, even with every slot empty, since the panel can also
    // import a save from a .json file.
    const loadBtn = this.add
      .text(width / 2, 610, 'Charger une partie', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#3a3a55',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    loadBtn.on('pointerdown', () => {
      new SaveLoadPanel(this, {
        mode: 'load',
        onLoad: (save) => {
          // The Board applies it in its own `create`, which is also how it
          // knows to skip the fresh-game movement reset.
          stagePendingLoad(save);
          this.scene.start('Board');
        },
      });
    });
    loadBtn.on('pointerover', () => loadBtn.setStyle({ backgroundColor: '#4a4a6a' }));
    loadBtn.on('pointerout', () => loadBtn.setStyle({ backgroundColor: '#3a3a55' }));
  }
}
