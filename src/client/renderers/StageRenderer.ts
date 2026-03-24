import Phaser from 'phaser';
import { STAGE, CANVAS_W, CANVAS_H } from '@simulation/constants';

export class StageRenderer {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.draw();
  }

  private draw(): void {
    const g = this.graphics;

    // Sky gradient background (dark blue to lighter blue)
    g.fillStyle(0x0f0f23);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ground platform
    g.fillStyle(0x8B4513); // Brown
    g.fillRect(STAGE.groundLeft, STAGE.groundY, STAGE.groundRight - STAGE.groundLeft, 20);

    // Ground surface line (lighter)
    g.lineStyle(2, 0xA0522D);
    g.lineBetween(STAGE.groundLeft, STAGE.groundY, STAGE.groundRight, STAGE.groundY);

    // Blast zone indicators (subtle dashed lines)
    g.lineStyle(1, 0xFF0000, 0.3);
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.top, STAGE.blastZone.left, STAGE.blastZone.bottom);
    g.lineBetween(STAGE.blastZone.right, STAGE.blastZone.top, STAGE.blastZone.right, STAGE.blastZone.bottom);
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.top, STAGE.blastZone.right, STAGE.blastZone.top);
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.bottom, STAGE.blastZone.right, STAGE.blastZone.bottom);
  }
}
