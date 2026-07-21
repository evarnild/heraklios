import Phaser from 'phaser';
import { resetSession } from '../ui/session';
import { startTestGame } from '../ui/testMode';
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

    this.add.text(width / 2, 220, 'Number of players', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);

    [2, 3, 4].forEach((count, i) => {
      const btn = this.add
        .text(width / 2 - 100 + i * 100, 270, String(count), {
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

    const testBtn = this.add
      .text(width / 2, 340, 'Mode test (2 joueurs, armées prêtes)', {
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
  }
}
