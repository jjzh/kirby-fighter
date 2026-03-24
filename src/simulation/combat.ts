import { Fighter } from './Fighter';
import { FighterAction, AttackPhase, type InputState, type Vec2 } from './types';
import {
  LIGHT_STARTUP_FRAMES, LIGHT_ACTIVE_FRAMES, LIGHT_RECOVERY_FRAMES,
  LIGHT_DAMAGE, LIGHT_BASE_KNOCKBACK, LIGHT_KNOCKBACK_SCALING,
  LIGHT_HITBOX_W, LIGHT_HITBOX_H, LIGHT_HITBOX_OFFSET_X,
  HEAVY_STARTUP_FRAMES, HEAVY_ACTIVE_FRAMES, HEAVY_RECOVERY_FRAMES,
  HEAVY_DAMAGE, HEAVY_BASE_KNOCKBACK, HEAVY_KNOCKBACK_SCALING,
  HEAVY_CHARGE_MIN_MULTIPLIER, HEAVY_CHARGE_MAX_FRAMES,
  HEAVY_HITBOX_W, HEAVY_HITBOX_H, HEAVY_HITBOX_OFFSET_X,
  HITSTUN_MULTIPLIER, FIGHTER_H,
  KNOCKBACK_UPWARD_BONUS, KNOCKBACK_UP_AIM_BONUS_MULT,
  KNOCKBACK_DOWN_AIM_BONUS_MULT, KNOCKBACK_MIN_LAUNCH_ANGLE,
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

/** Default launch angle (radians above horizontal) when no vertical input is held */
const DEFAULT_LAUNCH_ANGLE = Math.PI / 6; // 30 degrees up

export function getAimDirection(input: InputState, facingRight: boolean): Vec2 {
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  if (dx === 0 && dy === 0) {
    // No input — launch at default angle (up and away)
    const sign = facingRight ? 1 : -1;
    dx = sign * Math.cos(DEFAULT_LAUNCH_ANGLE);
    dy = -Math.sin(DEFAULT_LAUNCH_ANGLE);
  } else if (dy === 0 && dx !== 0) {
    // Pure horizontal input — still mix in upward angle
    const sign = dx > 0 ? 1 : -1;
    dx = sign * Math.cos(DEFAULT_LAUNCH_ANGLE);
    dy = -Math.sin(DEFAULT_LAUNCH_ANGLE);
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
  return {
    x: fighter.x + fighter.aimDirection.x * data.hitboxOffsetX,
    y: (fighter.y - FIGHTER_H / 2) + fighter.aimDirection.y * data.hitboxOffsetX,
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
  // Handle charge release → fire heavy attack
  if (fighter.action === FighterAction.ChargeHeavy) {
    // Update aim preview every frame during charge
    fighter.aimDirection = getAimDirection(input, fighter.facingRight);
    if (!input.heavy) {
      // Released — capture final aim, store charge duration, fire the heavy attack
      fighter.heavyChargeFrames = fighter.actionFrame;
      const finalAim = { ...fighter.aimDirection };
      fighter.setAction(FighterAction.AttackHeavy);
      fighter.aimDirection = finalAim; // restore after setAction reset
    }
    return;
  }

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
    const aim = getAimDirection(input, fighter.facingRight);
    fighter.setAction(FighterAction.AttackLight);
    fighter.aimDirection = aim;
  } else if (heavyJustPressed) {
    fighter.setAction(FighterAction.ChargeHeavy);
    fighter.aimDirection = getAimDirection(input, fighter.facingRight);
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

export function applyKnockback(fighter: Fighter, magnitude: number, direction: Vec2, isGrounded = false): void {
  let vx = direction.x * magnitude;
  let vy = direction.y * magnitude;

  // Scale upward bonus by aim direction:
  // aiming up → amplified, aiming down → suppressed
  let bonusMult = 1;
  if (direction.y < -0.3) {
    bonusMult = KNOCKBACK_UP_AIM_BONUS_MULT;   // Aiming up — bonus amplified
  } else if (direction.y > 0.3) {
    bonusMult = KNOCKBACK_DOWN_AIM_BONUS_MULT;  // Aiming down (spike) — bonus suppressed
  }
  vy += KNOCKBACK_UPWARD_BONUS * bonusMult;

  // Force minimum launch angle when defender is grounded
  if (isGrounded && vy >= 0) {
    // Ensure at least some upward launch
    const minVy = -Math.abs(vx) * Math.tan(KNOCKBACK_MIN_LAUNCH_ANGLE);
    vy = Math.min(vy, minVy);
  }

  fighter.velocityX = vx;
  fighter.velocityY = vy;
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

/** Get damage/knockback multiplier based on heavy charge duration. Lerps from 0.7 to 1.0. */
export function getHeavyChargeMultiplier(chargeFrames: number): number {
  const t = Math.min(chargeFrames / HEAVY_CHARGE_MAX_FRAMES, 1);
  return HEAVY_CHARGE_MIN_MULTIPLIER + t * (1 - HEAVY_CHARGE_MIN_MULTIPLIER);
}
