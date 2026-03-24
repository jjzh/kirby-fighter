import Phaser from 'phaser';
import { FighterAction, type FighterSnapshot } from '@simulation/types';
import { PLAYER_COLORS, FIGHTER_W, FIGHTER_H } from '@simulation/constants';

export class FighterRenderer {
  private body: Phaser.GameObjects.Ellipse;
  private eyes: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private index: number;

  private hitboxDebug: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, index: number) {
    this.scene = scene;
    this.index = index;
    const color = PLAYER_COLORS[index];

    // Kirby body — round ellipse
    this.body = scene.add.ellipse(0, 0, FIGHTER_W, FIGHTER_H, color);
    this.body.setStrokeStyle(2, 0x000000);

    // Eyes — drawn with graphics
    this.eyes = scene.add.graphics();

    // Debug hitbox (hidden by default)
    this.hitboxDebug = scene.add.rectangle(0, 0, 0, 0, 0xFF0000, 0.3);
    this.hitboxDebug.setVisible(false);
  }

  update(state: FighterSnapshot): void {
    if (state.action === FighterAction.Dead && state.stocks <= 0) {
      this.body.setVisible(false);
      this.eyes.setVisible(false);
      this.hitboxDebug.setVisible(false);
      return;
    }

    this.body.setVisible(true);
    this.eyes.setVisible(true);

    // Position (state.y is feet position, body center is up by half height)
    this.body.setPosition(state.x, state.y - FIGHTER_H / 2);

    // Alpha for invincibility (blink)
    const blinking = state.invincibleFrames > 0 && Math.floor(state.invincibleFrames / 4) % 2 === 0;
    this.body.setAlpha(blinking ? 0.4 : 1);

    // Captured state — make tiny
    if (state.suck.capturedBy >= 0) {
      this.body.setScale(0.3);
      this.eyes.setVisible(false);
      return;
    } else {
      this.body.setScale(1);
    }

    // Inflate during inhale
    if (state.action === FighterAction.Inhale) {
      this.body.setScale(1.1);
    } else if (state.action === FighterAction.CaptureHold) {
      this.body.setScale(1.3); // Puffed up while holding someone
    } else {
      this.body.setScale(1);
    }

    // Draw eyes
    this.eyes.clear();
    const eyeOffsetX = state.facingRight ? 6 : -6;
    const eyeY = state.y - FIGHTER_H / 2 - 4;
    const eyeX = state.x + eyeOffsetX;

    // Eye whites
    this.eyes.fillStyle(0xFFFFFF);
    this.eyes.fillEllipse(eyeX - 5, eyeY, 8, 10);
    this.eyes.fillEllipse(eyeX + 5, eyeY, 8, 10);

    // Pupils
    const pupilShift = state.facingRight ? 1.5 : -1.5;
    this.eyes.fillStyle(0x000000);
    this.eyes.fillCircle(eyeX - 5 + pupilShift, eyeY, 2.5);
    this.eyes.fillCircle(eyeX + 5 + pupilShift, eyeY, 2.5);

    // Color tint during hitstun
    if (state.action === FighterAction.Hitstun) {
      this.body.setFillStyle(0xFFFFFF);
    } else {
      this.body.setFillStyle(PLAYER_COLORS[this.index]);
    }

    // Squash/stretch for attacks
    if (state.action === FighterAction.AttackLight || state.action === FighterAction.AttackHeavy) {
      this.body.setScale(state.facingRight ? 1.2 : 1.2, 0.85);
    }

    this.hitboxDebug.setVisible(false);
  }
}
