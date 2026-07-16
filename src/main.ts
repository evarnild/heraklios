import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { ArmyBuilderScene } from './scenes/ArmyBuilderScene';
import { PlacementScene } from './scenes/PlacementScene';
import { BoardScene } from './scenes/BoardScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: 'app',
  width: 1100,
  height: 750,
  backgroundColor: '#1a1408',
  scene: [MenuScene, ArmyBuilderScene, PlacementScene, BoardScene, GameOverScene],
};

new Phaser.Game(config);
