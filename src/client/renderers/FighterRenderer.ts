import Phaser from 'phaser';
import { FighterAction, type FighterSnapshot } from '@simulation/types';
import { PLAYER_COLORS, FIGHTER_H } from '@simulation/constants';

/** Map FighterAction to spritesheet animation name */
function getAnimName(action: FighterAction, velocityY: number): string {
  switch (action) {
    case FighterAction.Run: return 'run';
    case FighterAction.Airborne: return velocityY < 0 ? 'jump' : 'fall';
    case FighterAction.AttackLight: return 'light';
    case FighterAction.AttackHeavy: return 'heavy';
    case FighterAction.Inhale: return 'inhale';
    case FighterAction.CaptureHold: return 'capture';
    case FighterAction.Hitstun: return 'hitstun';
    case FighterAction.Projectile: return 'hitstun';
    case FighterAction.Dead: return 'dead';
    default: return 'idle';
  }
}

/** Player tint colors — P1 is natural pink (no tint), others get tinted */
const PLAYER_TINTS = [
  0xFFFFFF, // P1: no tint (natural pink Kirby)
  0x6699FF, // P2: blue tint
  0x66FF66, // P3: green tint
  0xFFFF66, // P4: yellow tint
];

export class FighterRenderer {
  private sprite: Phaser.GameObjects.Sprite;
  private currentAnim = '';
  private index: number;

  constructor(scene: Phaser.Scene, index: number) {
    this.index = index;

    // Create sprite from atlas
    this.sprite = scene.add.sprite(0, 0, 'fighter-kirby', 'idle_0');
    this.sprite.setTint(PLAYER_TINTS[index] ?? 0xFFFFFF);

    // Create all animations (only once, first renderer creates them)
    if (!scene.anims.exists('kirby_idle')) {
      this.createAnimations(scene);
    }
  }

  private createAnimations(scene: Phaser.Scene): void {
    const anims: { key: string; frames: string[]; frameRate: number; repeat: number }[] = [
      { key: 'kirby_idle', frames: ['idle_0', 'idle_1', 'idle_2', 'idle_3'], frameRate: 6, repeat: -1 },
      { key: 'kirby_run', frames: ['run_0', 'run_1', 'run_2', 'run_3', 'run_4', 'run_5'], frameRate: 10, repeat: -1 },
      { key: 'kirby_jump', frames: ['jump_0', 'jump_1'], frameRate: 6, repeat: -1 },
      { key: 'kirby_fall', frames: ['fall_0', 'fall_1'], frameRate: 6, repeat: -1 },
      { key: 'kirby_light', frames: ['light_0', 'light_1', 'light_2', 'light_3'], frameRate: 15, repeat: 0 },
      { key: 'kirby_heavy', frames: ['heavy_0', 'heavy_1', 'heavy_2', 'heavy_3', 'heavy_4', 'heavy_5'], frameRate: 12, repeat: 0 },
      { key: 'kirby_inhale', frames: ['inhale_0', 'inhale_1', 'inhale_2', 'inhale_2', 'inhale_3', 'inhale_3', 'inhale_3', 'inhale_4', 'inhale_4'], frameRate: 10, repeat: -1 },
      { key: 'kirby_capture', frames: ['capture_0', 'capture_1'], frameRate: 4, repeat: -1 },
      { key: 'kirby_hitstun', frames: ['hitstun_0', 'hitstun_1', 'hitstun_2', 'hitstun_3'], frameRate: 12, repeat: -1 },
      { key: 'kirby_dead', frames: ['dead_0', 'dead_1'], frameRate: 8, repeat: -1 },
    ];

    for (const anim of anims) {
      scene.anims.create({
        key: anim.key,
        frames: anim.frames.map(f => ({ key: 'fighter-kirby', frame: f })),
        frameRate: anim.frameRate,
        repeat: anim.repeat,
      });
    }
  }

  update(state: FighterSnapshot): void {
    if (state.action === FighterAction.Dead && state.stocks <= 0) {
      this.sprite.setVisible(false);
      return;
    }

    this.sprite.setVisible(true);

    // Position — sprite origin is center, state.y is feet
    this.sprite.setPosition(state.x, state.y - FIGHTER_H / 2);

    // Facing direction — flip sprite horizontally
    this.sprite.setFlipX(!state.facingRight);

    // Invincibility blink
    const blinking = state.invincibleFrames > 0 && Math.floor(state.invincibleFrames / 4) % 2 === 0;
    this.sprite.setAlpha(blinking ? 0.4 : 1);

    // Captured — shrink
    if (state.suck.capturedBy >= 0) {
      this.sprite.setScale(0.4);
      return;
    }

    // Scale based on state
    if (state.action === FighterAction.CaptureHold) {
      this.sprite.setScale(1.2);
    } else {
      this.sprite.setScale(1);
    }

    // Hitstun flash — briefly go white
    if (state.action === FighterAction.Hitstun && state.actionFrame < 4) {
      this.sprite.setTintFill(0xFFFFFF);
    } else {
      this.sprite.clearTint();
      this.sprite.setTint(PLAYER_TINTS[this.index] ?? 0xFFFFFF);
    }

    // Play correct animation
    const animName = 'kirby_' + getAnimName(state.action, state.velocityY);
    if (this.currentAnim !== animName) {
      this.currentAnim = animName;
      this.sprite.play(animName);
    }
  }
}
