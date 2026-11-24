import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { ArmyBuilderScene } from './scenes/ArmyBuilderScene';
import { PlacementScene } from './scenes/PlacementScene';
import { BoardScene } from './scenes/BoardScene';
import { GameOverScene } from './scenes/GameOverScene';
import { canvasSize } from './ui/canvasSize';

// §88: the width is read once, here (no resize listener, so a resized window
// changes nothing until reload). #app is 100vw; innerWidth is the fallback.
const { width, height } = canvasSize(document.getElementById('app')?.clientWidth || window.innerWidth);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: 'app',
  width,
  height,
  backgroundColor: '#1a1408',
  scene: [MenuScene, ArmyBuilderScene, PlacementScene, BoardScene, GameOverScene],
};

const game = new Phaser.Game(config);

// Stop the browser page itself from scrolling/zooming when the user
// scrolls or pinch-zooms (trackpad) over the map â€” MapView handles wheel
// events itself to zoom the camera instead.
game.canvas?.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

// Browser smoke suite (`npm run e2e`): the test hook exists only on the dev
// server. The dynamic import under this guard is dropped from production
// builds, and e2e/global-setup.ts fails the run if it ever isn't.
if (import.meta.env.DEV) {
  void import('./ui/devHook').then(({ installDevHook }) => installDevHook(game));
}
