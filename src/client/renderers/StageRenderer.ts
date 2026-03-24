import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '@simulation/constants';

export class StageRenderer {
  private bg: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.image(CANVAS_W / 2, CANVAS_H / 2, 'arena-bg');
    this.bg.setDepth(-1000);

    // Scale to cover the entire canvas without distorting aspect ratio.
    const scale = Math.max(CANVAS_W / this.bg.width, CANVAS_H / this.bg.height);
    this.bg.setScale(scale);
  }
}
