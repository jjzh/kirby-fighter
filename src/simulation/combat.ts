import { Fighter } from './Fighter';
import { FighterAction, AttackPhase, type InputState, type Vec2 } from './types';
import {
  LIGHT_STARTUP_FRAMES, LIGHT_ACTIVE_FRAMES, LIGHT_RECOVERY_FRAMES,
  LIGHT_DAMAGE, LIGHT_BASE_KNOCKBACK, LIGHT_KNOCKBACK_SCALING,
  LIGHT_HITBOX_W, LIGHT_HITBOX_H, LIGHT_HITBOX_OFFSET_X,
  HEAVY_STARTUP_FRAMES, HEAVY_ACTIVE_FRAMES, HEAVY_RECOVERY_FRAMES,
  HEAVY_DAMAGE, HEAVY_BASE_KNOCKBACK, HEAVY_KNOCKBACK_SCALING,
  HEAVY_HITBOX_W, HEAVY_HITBOX_H, HEAVY_HITBOX_OFFSET_X,
  HITSTUN_MULTIPLIER, FIGHTER_H,
} from './constants';

export interface Rect {
  x: number; // center x
  y: number; // center y
  w: number;
  h: number;
}

interface AttackData {
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  damage: number;
  baseKnockback: number;
  knockbackScaling: number;
  hitboxW: number;
  hitboxH: number;
  hitboxOffsetX: number;
}

const ATTACK_DATA: Record<string, AttackData> = {
  light: {
    startupFrames: LIGHT_STARTUP_FRAMES,
    activeFrames: LIGHT_ACTIVE_FRAMES,
    recoveryFrames: LIGHT_RECOVERY_FRAMES,
    damage: LIGHT_DAMAGE,
    baseKnockback: LIGHT_BASE_KNOCKBACK,
    knockbackScaling: LIGHT_KNOCKBACK_SCALING,
    hitboxW: LIGHT_HITBOX_W,
    hitboxH: LIGHT_HITBOX_H,
    hitboxOffsetX: LIGHT_HITBOX_OFFSET_X,
  },
  heavy: {
    startupFrames: HEAVY_STARTUP_FRAMES,
    activeFrames: HEAVY_ACTIVE_FRAMES,
    recoveryFrames: HEAVY_RECOVERY_FRAMES,
    damage: HEAVY_DAMAGE,
    baseKnockback: HEAVY_BASE_KNOCKBACK,
    knockbackScaling: HEAVY_KNOCKBACK_SCALING,
    hitboxW: HEAVY_HITBOX_W,
    hitboxH: HEAVY_HITBOX_H,
    hitboxOffsetX: HEAVY_HITBOX_OFFSET_X,
  },
};

export function getAimDirection(input: InputState, facingRight: boolean): Vec2 {
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (dx === 0 && dy === 0) {
    dx = facingRight ? 1 : -1;
  }
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dx / len, y: dy / len };
}

function getAttackType(action: FighterAction): string | null {
  if (action === FighterAction.AttackLight) return 'light';
  if (action === FighterAction.AttackHeavy) return 'heavy';
  return null;
}

export function getAttackPhase(fighter: Fighter): AttackPhase | null {
  const type = getAttackType(fighter.action);
  if (!type) return null;
  const data = ATTACK_DATA[type];
  const frame = fighter.actionFrame;
  if (frame < data.startupFrames) return AttackPhase.Startup;
  if (frame < data.startupFrames + data.activeFrames) return AttackPhase.Active;
  if (frame < data.startupFrames + data.activeFrames + data.recoveryFrames) return AttackPhase.Recovery;
  return null;
}

export function getAttackTotalFrames(type: string): number {
  const data = ATTACK_DATA[type];
  return data.startupFrames + data.activeFrames + data.recoveryFrames;
}

export function getAttackHitbox(fighter: Fighter, type: string): Rect {
  const data = ATTACK_DATA[type];
  const offsetX = fighter.facingRight ? data.hitboxOffsetX : -data.hitboxOffsetX;
  return {
    x: fighter.x + offsetX,
    y: fighter.y - FIGHTER_H / 2,
    w: data.hitboxW,
    h: data.hitboxH,
  };
}

export function getHurtbox(fighter: Fighter): Rect {
  return {
    x: fighter.x,
    y: fighter.y - FIGHTER_H / 2,
    w: 40,
    h: FIGHTER_H,
  };
}

export function checkHitboxOverlap(a: Rect, b: Rect): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
         Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

export function calculateKnockback(base: number, scaling: number, damage: number): number {
  return base + damage * scaling;
}

export function processAttack(fighter: Fighter, input: InputState): void {
  const inAttack = fighter.action === FighterAction.AttackLight ||
                   fighter.action === FighterAction.AttackHeavy;
  if (inAttack) return;

  const canAttack = fighter.action === FighterAction.Idle ||
                    fighter.action === FighterAction.Run ||
                    fighter.action === FighterAction.Airborne;
  if (!canAttack) return;

  const lightJustPressed = input.light && !fighter.prevLightPressed;
  const heavyJustPressed = input.heavy && !fighter.prevHeavyPressed;

  if (lightJustPressed) {
    fighter.setAction(FighterAction.AttackLight);
  } else if (heavyJustPressed) {
    fighter.setAction(FighterAction.AttackHeavy);
  }
}

export function tickAttack(fighter: Fighter): void {
  const type = getAttackType(fighter.action);
  if (!type) return;
  const totalFrames = getAttackTotalFrames(type);
  if (fighter.actionFrame >= totalFrames) {
    fighter.setAction(fighter.velocityY !== 0 ? FighterAction.Airborne : FighterAction.Idle);
  }
}

export function applyKnockback(fighter: Fighter, magnitude: number, direction: Vec2): void {
  fighter.velocityX = direction.x * magnitude;
  fighter.velocityY = direction.y * magnitude;
  fighter.setAction(FighterAction.Hitstun);
}

export function tickHitstun(fighter: Fighter): void {
  if (fighter.action !== FighterAction.Hitstun) return;
  const knockbackMag = Math.sqrt(
    fighter.velocityX * fighter.velocityX + fighter.velocityY * fighter.velocityY
  );
  const hitstunDuration = Math.ceil(knockbackMag * HITSTUN_MULTIPLIER);
  if (fighter.actionFrame >= hitstunDuration) {
    fighter.setAction(fighter.velocityY !== 0 ? FighterAction.Airborne : FighterAction.Idle);
  }
}

export function getAttackData(type: string): AttackData {
  return ATTACK_DATA[type];
}
