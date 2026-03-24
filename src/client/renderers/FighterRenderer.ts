import Phaser from 'phaser';
import { FighterAction, type FighterSnapshot } from '@simulation/types';
import { PLAYER_COLORS, FIGHTER_H, INHALE_CONE_HALF_ANGLE } from '@simulation/constants';

/** Map FighterAction to spritesheet animation name */
function getAnimName(action: FighterAction, velocityY: number): string {
  switch (action) {
    case FighterAction.Run: return 'run';
    case FighterAction.Airborne: return velocityY < 0 ? 'jump' : 'fall';
    case FighterAction.AttackLight: return 'light';
    case FighterAction.AttackHeavy: return 'heavy';
    case FighterAction.CrushAttack: return velocityY !== 0 ? 'crush_fall' : 'crush_land';
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
  private scene: Phaser.Scene;
  private currentAnim = '';
  private index: number;
  private bottomPadCache = new Map<string, number>();
  private suckLineTimer = 0;
  private lastAttackSfxFrame = -1;
  private suckWhoosh?: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene, index: number) {
    this.scene = scene;
    this.index = index;

    // Create sprite from atlas
    this.sprite = scene.add.sprite(0, 0, 'fighter-kirby', 'idle_0');
    this.sprite.setTint(PLAYER_TINTS[index] ?? 0xFFFFFF);

    // Create all animations (only once, first renderer creates them)
    if (!scene.anims.exists('kirby_idle')) {
      this.createAnimations(scene);
    }

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
      { key: 'kirby_heavy', frames: ['heavy_0', 'heavy_1', 'heavy_2', 'heavy_3', 'heavy_4', 'heavy_5'], frameRate: 12, repeat: 0 },
      { key: 'kirby_inhale', frames: ['inhale_0', 'inhale_1', 'inhale_2', 'inhale_2', 'inhale_3', 'inhale_3', 'inhale_3', 'inhale_4', 'inhale_4'], frameRate: 10, repeat: -1 },
      { key: 'kirby_capture', frames: ['capture_0', 'capture_1'], frameRate: 4, repeat: -1 },
      { key: 'kirby_hitstun', frames: ['hitstun_0', 'hitstun_1', 'hitstun_2', 'hitstun_3'], frameRate: 12, repeat: -1 },
      { key: 'kirby_dead', frames: ['dead_0', 'dead_1'], frameRate: 8, repeat: -1 },
      { key: 'kirby_fire', frames: ['fire_0', 'fire_1', 'fire_2', 'fire_3'], frameRate: 16, repeat: 0 },
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

    // Facing direction — flip sprite horizontally
    this.sprite.setFlipX(!state.facingRight);

    // Invincibility blink
    const blinking = state.invincibleFrames > 0 && Math.floor(state.invincibleFrames / 4) % 2 === 0;
    this.sprite.setAlpha(blinking ? 0.4 : 1);

    const scale = state.suck.capturedBy >= 0 ? 0.4 : (state.action === FighterAction.CaptureHold ? 1.2 : 1);
    this.sprite.setScale(scale);

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
      if (animName === 'kirby_jump') {
        const isDoubleJump = this.currentAnim === 'kirby_fall';
        this.emitJumpSwoosh(state.x, state.y, isDoubleJump);
      }
      if (animName === 'kirby_light' || animName === 'kirby_heavy' || animName === 'kirby_crush_fall' || animName === 'kirby_crush_land') {
        // Avoid double-firing if we transition animations multiple times on the same sim frame.
        if (this.lastAttackSfxFrame !== state.actionFrame) {
          this.lastAttackSfxFrame = state.actionFrame;
          this.playAttackSfx();
        }
      }
      this.currentAnim = animName;
      this.sprite.play(animName);
    }

    // Inhale wind lines
    if (state.action === FighterAction.Inhale) {
      this.ensureSuckWhoosh();
      if (this.suckWhoosh && !this.suckWhoosh.isPlaying) {
        this.suckWhoosh.play();
      }
      this.suckLineTimer++;
      if (this.suckLineTimer % 3 === 0) {
        this.emitSuckLines(state.x, state.y - FIGHTER_H / 2, state.facingRight);
      }
    } else {
      if (this.suckWhoosh?.isPlaying) {
        this.suckWhoosh.stop();
      }
      this.suckLineTimer = 0;
    }

    // Position — state.y is "feet". Atlas frames can include transparent padding below the character,
    // which makes them appear to float even when their feet Y is correct. Compensate by shifting
    // down by the bottom transparent padding of the current frame (cached).
    const frameName = (this.sprite.frame?.name ?? 'idle_0') as string;
    const frameH = this.sprite.frame?.height ?? 48;
    const bottomPad = this.getBottomTransparentPad(frameName);
    this.sprite.setPosition(state.x, state.y - (frameH * scale) / 2 + bottomPad * scale);
  }

  private getBottomTransparentPad(frameName: string): number {
    const cached = this.bottomPadCache.get(frameName);
    if (cached !== undefined) return cached;

    const frame = this.scene.textures.getFrame('fighter-kirby', frameName);
    const w = frame?.width ?? 48;
    const h = frame?.height ?? 48;

    let bottomOpaqueRow = -1;
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        const a = this.scene.textures.getPixelAlpha(x, y, 'fighter-kirby', frameName);
        if (a > 10) { // ignore tiny fringe pixels
          bottomOpaqueRow = y;
          break;
        }
      }
      if (bottomOpaqueRow >= 0) break;
    }

    const pad = bottomOpaqueRow >= 0 ? (h - 1 - bottomOpaqueRow) : 0;
    this.bottomPadCache.set(frameName, pad);
    return pad;
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
    if (this.suckWhoosh && !this.suckWhoosh.isDestroyed) return;
    this.suckWhoosh = this.scene.sound.add('sfx_suck_whoosh', { loop: true, volume: 0.25 });
    this.suckWhoosh.setLoop(true);
    this.suckWhoosh.setVolume(0.25);
  }

  /** Spawn expanding crescent arcs at the fighter's feet */
  private emitJumpSwoosh(x: number, feetY: number, isDoubleJump: boolean): void {
    const arcs = isDoubleJump
      ? [
          { startDeg: 160, endDeg: 380, radius: 10, lineWidth: 2.5, delay: 0, duration: 220, scaleX: 2.0, scaleY: 1.0 },
          { startDeg: 190, endDeg: 350, radius: 14, lineWidth: 2,   delay: 40, duration: 260, scaleX: 2.4, scaleY: 1.2 },
          { startDeg: 210, endDeg: 330, radius: 8,  lineWidth: 1.5, delay: 70, duration: 200, scaleX: 1.8, scaleY: 0.8 },
        ]
      : [
          { startDeg: 200, endDeg: 340, radius: 10, lineWidth: 2.5, delay: 0,  duration: 250, scaleX: 2.2, scaleY: 1.2 },
          { startDeg: 215, endDeg: 325, radius: 14, lineWidth: 2,   delay: 50, duration: 280, scaleX: 2.6, scaleY: 1.4 },
        ];

    const y = isDoubleJump ? feetY - FIGHTER_H / 2 : feetY;

    for (const arc of arcs) {
      const gfx = this.scene.add.graphics();
      gfx.setPosition(x, y);
      gfx.setAlpha(0.85);
      gfx.lineStyle(arc.lineWidth, 0xffffff, 1);
      gfx.beginPath();
      gfx.arc(
        0, 0, arc.radius,
        Phaser.Math.DegToRad(arc.startDeg),
        Phaser.Math.DegToRad(arc.endDeg),
        false,
      );
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

      const duration = 250 + Math.random() * 150;
      this.scene.tweens.add({
        targets: gfx,
        x: x,
        y: mouthY,
        alpha: 0,
        duration,
        delay: i * 25,
        ease: 'Quad.easeIn',
        onComplete: () => gfx.destroy(),
      });
    }
  }
}
