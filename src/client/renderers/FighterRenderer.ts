import Phaser from 'phaser';
import { FighterAction, AttackPhase, type FighterSnapshot } from '@simulation/types';
import { PLAYER_COLORS, FIGHTER_H, FIGHTER_W, INHALE_CONE_HALF_ANGLE, INHALE_MIN_RANGE, INHALE_MAX_RANGE, INHALE_RAMP_FRAMES, SUCK_RANGE_TABLE, SUCK_SHIELD_MAX } from '@simulation/constants';
import { getAttackHitbox, getAttackPhase, getHurtbox, type Rect } from '@simulation/combat';
import { Fighter } from '@simulation/Fighter';

const AIM_ROTATION_CLAMP_DEG = 70;

/** Map FighterAction to spritesheet animation name */
function getAnimName(action: FighterAction, velocityY: number): string {
  switch (action) {
    case FighterAction.Run: return 'run';
    case FighterAction.Airborne: return velocityY < 0 ? 'jump' : 'fall';
    case FighterAction.AttackLight: return 'light';
    case FighterAction.AttackHeavy: return 'heavy';
    case FighterAction.ChargeHeavy: return 'charge_heavy';
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

// Shield bar config
const SHIELD_SEG_W = 6;
const SHIELD_SEG_H = 3;
const SHIELD_SEG_GAP = 1;
const SHIELD_BAR_Y_OFFSET = -8; // above the sprite top

export class FighterRenderer {
  private sprite: Phaser.GameObjects.Sprite;
  private debugGfx: Phaser.GameObjects.Graphics;
  private shieldSegments: Phaser.GameObjects.Rectangle[] = [];
  private currentAnim = '';
  private index: number;
  static showHitboxes = true;

  constructor(scene: Phaser.Scene, index: number) {
    this.index = index;

    // Create sprite from atlas
    this.sprite = scene.add.sprite(0, 0, 'fighter-kirby', 'idle_0');
    this.sprite.setTint(PLAYER_TINTS[index] ?? 0xFFFFFF);

    // Shield bar segments (positioned each frame in update)
    for (let s = 0; s < SUCK_SHIELD_MAX; s++) {
      const seg = scene.add.rectangle(0, 0, SHIELD_SEG_W, SHIELD_SEG_H, PLAYER_COLORS[index]);
      seg.setDepth(200);
      this.shieldSegments.push(seg);
    }

    this.debugGfx = scene.add.graphics();
    this.debugGfx.setDepth(100);

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
      { key: 'kirby_heavy', frames: ['heavy_0', 'heavy_1', 'heavy_2', 'heavy_3', 'heavy_4', 'heavy_5', 'heavy_6'], frameRate: 12, repeat: 0 },
      { key: 'kirby_charge_heavy', frames: ['charge_heavy_0'], frameRate: 1, repeat: -1 },
      { key: 'kirby_inhale', frames: ['inhale_0', 'inhale_1', 'inhale_2', 'inhale_2', 'inhale_3', 'inhale_3', 'inhale_3', 'inhale_3'], frameRate: 10, repeat: -1 },
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

  getGameObjects(): Phaser.GameObjects.GameObject[] {
    return [this.sprite, ...this.shieldSegments, this.debugGfx];
  }

  update(state: FighterSnapshot): void {
    if (state.action === FighterAction.Dead && state.stocks <= 0) {
      this.sprite.setVisible(false);
      for (const seg of this.shieldSegments) seg.setVisible(false);
      return;
    }

    this.sprite.setVisible(true);

    // Position — sprite origin is center, state.y is feet
    this.sprite.setPosition(state.x, state.y - FIGHTER_H / 2);

    // Shield bar — floating above the fighter
    const totalW = SUCK_SHIELD_MAX * SHIELD_SEG_W + (SUCK_SHIELD_MAX - 1) * SHIELD_SEG_GAP;
    const barStartX = state.x - totalW / 2;
    const barY = state.y - FIGHTER_H + SHIELD_BAR_Y_OFFSET;
    for (let s = 0; s < this.shieldSegments.length; s++) {
      const seg = this.shieldSegments[s];
      seg.setPosition(
        barStartX + s * (SHIELD_SEG_W + SHIELD_SEG_GAP) + SHIELD_SEG_W / 2,
        barY
      );
      seg.setFillStyle(
        state.suckShield > s ? PLAYER_COLORS[this.index] : 0x333333
      );
      seg.setVisible(state.suck.capturedBy < 0); // hide when captured
    }

    // Facing direction — flip sprite horizontally
    this.sprite.setFlipX(!state.facingRight);

    // Sprite rotation based on aim direction during attacks
    const isAimed = state.action === FighterAction.AttackLight ||
                    state.action === FighterAction.AttackHeavy ||
                    state.action === FighterAction.ChargeHeavy;
    if (isAimed && Math.abs(state.aimDirection.y) > 0.6) {
      const forwardX = state.facingRight ? 1 : -1;
      const dot = state.aimDirection.x * forwardX;
      const cross = state.aimDirection.y * forwardX;
      let angleDeg = Math.atan2(cross, dot) * (180 / Math.PI);
      angleDeg = Math.max(-AIM_ROTATION_CLAMP_DEG, Math.min(AIM_ROTATION_CLAMP_DEG, angleDeg));
      this.sprite.angle = state.facingRight ? angleDeg : -angleDeg;
    } else {
      this.sprite.angle = 0;
    }

    // Invincibility blink
    const blinking = state.invincibleFrames > 0 && Math.floor(state.invincibleFrames / 4) % 2 === 0;
    this.sprite.setAlpha(blinking ? 0.4 : 1);

    // Captured — hidden inside the captor
    if (state.suck.capturedBy >= 0) {
      this.sprite.setAlpha(0);
      return;
    }

    // Scale based on state
    if (state.action === FighterAction.Inhale) {
      const t = Math.min(state.actionFrame / 30, 1);
      this.sprite.setScale(1 + t * 0.2);
    } else if (state.action === FighterAction.CaptureHold) {
      this.sprite.setScale(1.2);
    } else {
      this.sprite.setScale(1);
    }

    // Charge heavy flash — alternating white flash, faster as charge builds
    if (state.action === FighterAction.ChargeHeavy) {
      const flashSpeed = Math.max(3, 8 - Math.floor(state.actionFrame / 10));
      const flashing = Math.floor(state.actionFrame / flashSpeed) % 2 === 0;
      if (flashing) {
        this.sprite.setTintFill(0xFFFFFF);
      } else {
        this.sprite.clearTint();
        this.sprite.setTint(PLAYER_TINTS[this.index] ?? 0xFFFFFF);
      }
    } else if (state.action === FighterAction.Hitstun && state.actionFrame < 4) {
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

    // Debug hitbox visualization
    this.debugGfx.clear();
    if (!FighterRenderer.showHitboxes) return;

    const tempFighter = new Fighter(state.colorIndex, state.x, state.y);
    tempFighter.facingRight = state.facingRight;
    tempFighter.action = state.action;
    tempFighter.actionFrame = state.actionFrame;
    tempFighter.aimDirection = state.aimDirection;

    // Hurtbox — green outline
    const hurtbox = getHurtbox(tempFighter);
    this.debugGfx.lineStyle(1, 0x00FF00, 0.5);
    this.drawRect(hurtbox);

    // Attack hitbox
    const phase = getAttackPhase(tempFighter);
    if (phase !== null) {
      const attackType = state.action === FighterAction.AttackLight ? 'light' : 'heavy';
      const hitbox = getAttackHitbox(tempFighter, attackType);
      if (phase === AttackPhase.Active) {
        this.debugGfx.fillStyle(0xFF0000, 0.3);
        this.fillRect(hitbox);
        this.debugGfx.lineStyle(2, 0xFF0000, 0.8);
        this.drawRect(hitbox);
      } else if (phase === AttackPhase.Startup) {
        this.debugGfx.lineStyle(1, 0xFFFF00, 0.4);
        this.drawRect(hitbox);
      }
    }

    // Suck cone — grows from inner to middle range over 0.5s
    if (state.action === FighterAction.Inhale) {
      const dir = state.facingRight ? 1 : -1;
      const ox = state.x;
      const oy = state.y - FIGHTER_H / 2;
      const t = Math.min(state.actionFrame / INHALE_RAMP_FRAMES, 1);
      const currentRange = INHALE_MIN_RANGE + t * (INHALE_MAX_RANGE - INHALE_MIN_RANGE);

      // Max range outline (faint)
      this.drawCone(ox, oy, dir, INHALE_MAX_RANGE, 0x4444FF, 0.05);
      // Current range (solid)
      this.drawCone(ox, oy, dir, currentRange, 0x4444FF, 0.15);
    }
  }

  private drawRect(r: Rect): void {
    this.debugGfx.strokeRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h);
  }

  private fillRect(r: Rect): void {
    this.debugGfx.fillRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h);
  }

  private drawCone(ox: number, oy: number, dir: number, range: number, color: number, alpha: number): void {
    const endY1 = oy - Math.sin(INHALE_CONE_HALF_ANGLE) * range;
    const endY2 = oy + Math.sin(INHALE_CONE_HALF_ANGLE) * range;
    const endX = ox + dir * Math.cos(INHALE_CONE_HALF_ANGLE) * range;
    this.debugGfx.fillStyle(color, alpha);
    this.debugGfx.beginPath();
    this.debugGfx.moveTo(ox, oy);
    this.debugGfx.lineTo(endX, endY1);
    this.debugGfx.lineTo(endX, endY2);
    this.debugGfx.closePath();
    this.debugGfx.fillPath();
  }
}
