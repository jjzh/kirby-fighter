import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { CANVAS_W, CANVAS_H } from '@simulation/constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#0f0f23',
  parent: document.body,
  scene: [GameScene],
};

new Phaser.Game(config);
