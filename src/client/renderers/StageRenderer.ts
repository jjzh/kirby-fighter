import Phaser from 'phaser';
import { STAGE, CANVAS_W, CANVAS_H } from '@simulation/constants';

export class StageRenderer {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.draw();
  }

  getGameObjects(): Phaser.GameObjects.GameObject[] {
    return [this.graphics];
  }

  private draw(): void {
    const g = this.graphics;

    const left = STAGE.groundLeft;
    const right = STAGE.groundRight;
    const groundY = STAGE.groundY;
    const platThick = 20;
    const taperDepth = 80;
    const taperInset = 60;

    // Sky background
    g.fillStyle(0x0f0f23);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Main ground platform top surface
    g.fillStyle(0x8B4513);
    g.fillRect(left, groundY, right - left, platThick);

    // Tapered underside (inverted trapezoid)
    g.fillStyle(0x6B3410);
    g.beginPath();
    g.moveTo(left, groundY + platThick);
    g.lineTo(right, groundY + platThick);
    g.lineTo(right - taperInset, groundY + platThick + taperDepth);
    g.lineTo(left + taperInset, groundY + platThick + taperDepth);
    g.closePath();
    g.fillPath();

    // Taper outline
    g.lineStyle(2, 0x4A2208);
    g.beginPath();
    g.moveTo(left, groundY + platThick);
    g.lineTo(left + taperInset, groundY + platThick + taperDepth);
    g.lineTo(right - taperInset, groundY + platThick + taperDepth);
    g.lineTo(right, groundY + platThick);
    g.strokePath();

    // Ground surface line
    g.lineStyle(2, 0xA0522D);
    g.lineBetween(left, groundY, right, groundY);

    // Floating platforms
    for (const p of STAGE.platforms) {
      const pw = p.right - p.left;
      const fpThick = 12;
      const fpTaper = 30;
      const fpInset = 20;

      // Platform top
      g.fillStyle(0x8B4513);
      g.fillRect(p.left, p.y, pw, fpThick);

      // Platform tapered underside
      g.fillStyle(0x6B3410);
      g.beginPath();
      g.moveTo(p.left, p.y + fpThick);
      g.lineTo(p.right, p.y + fpThick);
      g.lineTo(p.right - fpInset, p.y + fpThick + fpTaper);
      g.lineTo(p.left + fpInset, p.y + fpThick + fpTaper);
      g.closePath();
      g.fillPath();

      // Platform outline
      g.lineStyle(1, 0x4A2208);
      g.beginPath();
      g.moveTo(p.left, p.y + fpThick);
      g.lineTo(p.left + fpInset, p.y + fpThick + fpTaper);
      g.lineTo(p.right - fpInset, p.y + fpThick + fpTaper);
      g.lineTo(p.right, p.y + fpThick);
      g.strokePath();

      // Surface line
      g.lineStyle(2, 0xA0522D);
      g.lineBetween(p.left, p.y, p.right, p.y);
    }

    // Blast zone indicators
    g.lineStyle(1, 0xFF0000, 0.3);
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.top, STAGE.blastZone.left, STAGE.blastZone.bottom);
    g.lineBetween(STAGE.blastZone.right, STAGE.blastZone.top, STAGE.blastZone.right, STAGE.blastZone.bottom);
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.top, STAGE.blastZone.right, STAGE.blastZone.top);
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.bottom, STAGE.blastZone.right, STAGE.blastZone.bottom);
  }
}
