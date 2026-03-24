import Phaser from 'phaser';
import { FighterAction, type FighterSnapshot } from '@simulation/types';
import { PLAYER_COLORS, FIGHTER_H, INHALE_CONE_HALF_ANGLE, SUCK_SHIELD_MAX } from '@simulation/constants';

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
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private shieldSegments: Phaser.GameObjects.Rectangle[] = [];
  private currentAnim = '';
  private index: number;
  private suckLineTimer = 0;
  private lastAttackSfxFrame = -1;
  private suckWhoosh?: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene, index: number) {
    this.scene = scene;
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

    // Create all animations (only once, first renderer creates them)
    if (!scene.anims.exists('kirby_idle')) {
      this.createAnimations(scene);
    }

    // Cleanup audio on scene shutdown
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.suckWhoosh?.stop();
      this.suckWhoosh?.destroy();
      this.suckWhoosh = undefined;
    });
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
    return [this.sprite, ...this.shieldSegments];
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
        s < SUCK_SHIELD_MAX - state.suckShield ? PLAYER_COLORS[this.index] : 0x333333
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
      // Jump swoosh on animation transition to jump
      if (animName === 'kirby_jump') {
        const isDoubleJump = this.currentAnim === 'kirby_fall';
        this.emitJumpSwoosh(state.x, state.y, isDoubleJump);
      }
      // Attack SFX on attack start
      if (animName === 'kirby_light' || animName === 'kirby_heavy') {
        if (this.lastAttackSfxFrame !== state.actionFrame) {
          this.lastAttackSfxFrame = state.actionFrame;
          this.playAttackSfx();
        }
      }
      // Hit effect on entering hitstun (disabled — fire frames not in current sprite sheet)
      // if (animName === 'kirby_hitstun' && this.currentAnim !== '') {
      //   FighterRenderer.spawnHitEffect(this.scene, state.x, state.y - FIGHTER_H / 2);
      // }
      this.currentAnim = animName;
      this.sprite.play(animName);
    }

    // Inhale wind lines + whoosh sound
    if (state.action === FighterAction.Inhale) {
      this.ensureSuckWhoosh();
      if (this.suckWhoosh && !(this.suckWhoosh as any).isPlaying) {
        this.suckWhoosh.play();
      }
      this.suckLineTimer++;
      if (this.suckLineTimer % 3 === 0) {
        this.emitSuckLines(state.x, state.y - FIGHTER_H / 2, state.facingRight);
      }
    } else {
      if ((this.suckWhoosh as any)?.isPlaying) {
        this.suckWhoosh!.stop();
      }
      this.suckLineTimer = 0;
    }
  }

  /** Spawn a fire burst effect at the given world position */
  static spawnHitEffect(scene: Phaser.Scene, x: number, y: number): void {
    const fx = scene.add.sprite(x, y, 'fighter-kirby', 'fire_0');
    fx.setScale(0.55);
    fx.setDepth(10);
    fx.play('kirby_fire');
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  private playAttackSfx(): void {
    const keys = ['sfx_punch', 'sfx_punch_alt'] as const;
    const key = keys[Math.floor(Math.random() * keys.length)];
    this.scene.sound.play(key, { volume: 0.6 });
  }

  private ensureSuckWhoosh(): void {
    if (this.suckWhoosh && !(this.suckWhoosh as any).isDestroyed) return;
    this.suckWhoosh = this.scene.sound.add('sfx_suck_whoosh', { loop: true, volume: 0.25 });
  }

  /** Spawn expanding crescent arcs at the fighter's feet */
  private emitJumpSwoosh(x: number, feetY: number, isDoubleJump: boolean): void {
    const arcs = isDoubleJump
      ? [
          { startDeg: 160, endDeg: 380, radius: 10, lineWidth: 2.5, delay: 0, duration: 220, scaleX: 2.0, scaleY: 1.0 },
          { startDeg: 190, endDeg: 350, radius: 14, lineWidth: 2, delay: 40, duration: 260, scaleX: 2.4, scaleY: 1.2 },
          { startDeg: 210, endDeg: 330, radius: 8, lineWidth: 1.5, delay: 70, duration: 200, scaleX: 1.8, scaleY: 0.8 },
        ]
      : [
          { startDeg: 200, endDeg: 340, radius: 10, lineWidth: 2.5, delay: 0, duration: 250, scaleX: 2.2, scaleY: 1.2 },
          { startDeg: 215, endDeg: 325, radius: 14, lineWidth: 2, delay: 50, duration: 280, scaleX: 2.6, scaleY: 1.4 },
        ];

    const y = isDoubleJump ? feetY - FIGHTER_H / 2 : feetY;

    for (const arc of arcs) {
      const gfx = this.scene.add.graphics();
      gfx.setPosition(x, y);
      gfx.setAlpha(0.85);
      gfx.lineStyle(arc.lineWidth, 0xffffff, 1);
      gfx.beginPath();
      gfx.arc(0, 0, arc.radius, Phaser.Math.DegToRad(arc.startDeg), Phaser.Math.DegToRad(arc.endDeg), false);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx,
        scaleX: arc.scaleX,
        scaleY: arc.scaleY,
        alpha: 0,
        delay: arc.delay,
        duration: arc.duration,
        ease: 'Quad.easeOut',
        onComplete: () => gfx.destroy(),
      });
    }
  }

  /** Spawn converging wind streaks within the inhale cone */
  private emitSuckLines(x: number, mouthY: number, facingRight: boolean): void {
    const dir = facingRight ? 1 : -1;
    const lineCount = 5;
    const colors = [0xffffff, 0xfff4cc, 0xffe0f0, 0xffd4ec, 0xfffff0];

    for (let i = 0; i < lineCount; i++) {
      const angle = (Math.random() - 0.5) * 2 * INHALE_CONE_HALF_ANGLE;
      const dist = 30 + Math.random() * 80;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const startX = x + cosA * dist * dir;
      const startY = mouthY + sinA * dist;

      const lineLen = 12 + Math.random() * 16;
      const dx = cosA * lineLen * dir;
      const dy = sinA * lineLen;

      const color = colors[Math.floor(Math.random() * colors.length)];
      const gfx = this.scene.add.graphics();
      gfx.setPosition(startX, startY);
      gfx.setAlpha(0.8 + Math.random() * 0.2);
      gfx.lineStyle(2 + Math.random() * 1.5, color, 1);
      gfx.lineBetween(0, 0, dx, dy);

      this.scene.tweens.add({
        targets: gfx,
        x,
        y: mouthY,
        alpha: 0,
        duration: 250 + Math.random() * 150,
        delay: i * 25,
        ease: 'Quad.easeIn',
        onComplete: () => gfx.destroy(),
      });
    }
  }
}
