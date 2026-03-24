import { describe, it, expect } from 'vitest';
import {
  getAttackHitbox, checkHitboxOverlap, calculateKnockback,
  processAttack, applyKnockback, getAimDirection,
} from '../combat';
import { Fighter } from '../Fighter';
import { FighterAction, NULL_INPUT } from '../types';
import {
  LIGHT_DAMAGE, HEAVY_DAMAGE, LIGHT_BASE_KNOCKBACK,
  LIGHT_KNOCKBACK_SCALING, LIGHT_STARTUP_FRAMES,
} from '../constants';

describe('getAimDirection', () => {
  it('returns angled launch direction when no directional input', () => {
    const dir = getAimDirection(NULL_INPUT, true);
    expect(dir.x).toBeGreaterThan(0); // Forward
    expect(dir.y).toBeLessThan(0); // Upward
    expect(Math.sqrt(dir.x * dir.x + dir.y * dir.y)).toBeCloseTo(1); // Normalized
  });

  it('aims up when up is held', () => {
    const dir = getAimDirection({ ...NULL_INPUT, up: true }, true);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(-1);
  });

  it('aims down when down is held', () => {
    const dir = getAimDirection({ ...NULL_INPUT, down: true }, true);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(1);
  });

  it('aims diagonally when up+right held', () => {
    const dir = getAimDirection({ ...NULL_INPUT, up: true, right: true }, true);
    expect(dir.x).toBeGreaterThan(0);
    expect(dir.y).toBeLessThan(0);
    expect(Math.sqrt(dir.x * dir.x + dir.y * dir.y)).toBeCloseTo(1);
  });
});

describe('getAttackHitbox', () => {
  it('places hitbox along aimDirection (right)', () => {
    const f = new Fighter(0, 500, 580);
    f.aimDirection = { x: 1, y: 0 };
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeGreaterThan(500);
    expect(hb.y).toBeCloseTo(580 - 48 / 2);
  });

  it('places hitbox along aimDirection (up)', () => {
    const f = new Fighter(0, 500, 580);
    f.aimDirection = { x: 0, y: -1 };
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeCloseTo(500);
    expect(hb.y).toBeLessThan(580 - 48 / 2);
  });

  it('places hitbox along aimDirection (diagonal up-right)', () => {
    const f = new Fighter(0, 500, 580);
    const d = Math.SQRT1_2;
    f.aimDirection = { x: d, y: -d };
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeGreaterThan(500);
    expect(hb.y).toBeLessThan(580 - 48 / 2);
  });
});

describe('checkHitboxOverlap', () => {
  it('detects overlapping rectangles', () => {
    const a = { x: 100, y: 100, w: 50, h: 50 };
    const b = { x: 120, y: 120, w: 50, h: 50 };
    expect(checkHitboxOverlap(a, b)).toBe(true);
  });

  it('detects non-overlapping rectangles', () => {
    const a = { x: 100, y: 100, w: 50, h: 50 };
    const b = { x: 200, y: 200, w: 50, h: 50 };
    expect(checkHitboxOverlap(a, b)).toBe(false);
  });
});

describe('calculateKnockback', () => {
  it('calculates knockback at 0% damage', () => {
    const kb = calculateKnockback(LIGHT_BASE_KNOCKBACK, LIGHT_KNOCKBACK_SCALING, 0);
    expect(kb).toBe(LIGHT_BASE_KNOCKBACK);
  });

  it('scales knockback with damage', () => {
    const kb = calculateKnockback(LIGHT_BASE_KNOCKBACK, LIGHT_KNOCKBACK_SCALING, 100);
    expect(kb).toBe(LIGHT_BASE_KNOCKBACK + 100 * LIGHT_KNOCKBACK_SCALING);
  });
});

describe('processAttack', () => {
  it('starts light attack on fresh press', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, light: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.AttackLight);
    expect(f.actionFrame).toBe(0);
  });

  it('does not restart attack if already attacking', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.AttackLight;
    f.actionFrame = 5;
    const input = { ...NULL_INPUT, light: true };
    processAttack(f, input);
    expect(f.actionFrame).toBe(5);
  });

  it('starts heavy charge on fresh press', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, heavy: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.ChargeHeavy);
  });

  it('releases heavy attack when heavy button released during charge', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.ChargeHeavy;
    f.actionFrame = 20;
    processAttack(f, NULL_INPUT); // heavy not held
    expect(f.action).toBe(FighterAction.AttackHeavy);
    expect(f.heavyChargeFrames).toBe(20);
  });
});

describe('processAttack aimDirection', () => {
  it('captures aimDirection on light attack start', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    const input = { ...NULL_INPUT, light: true, up: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.AttackLight);
    expect(f.aimDirection.y).toBe(-1);
  });

  it('updates aimDirection each frame during ChargeHeavy', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    f.action = FighterAction.ChargeHeavy;
    f.actionFrame = 5;
    const input = { ...NULL_INPUT, heavy: true, up: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.ChargeHeavy);
    expect(f.aimDirection.y).toBe(-1);
  });

  it('locks aimDirection on heavy release', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    f.action = FighterAction.ChargeHeavy;
    f.actionFrame = 20;
    const input = { ...NULL_INPUT, up: true }; // heavy released, aiming up
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.AttackHeavy);
    expect(f.aimDirection.y).toBe(-1);
  });
});

describe('applyKnockback', () => {
  it('applies velocity with upward bonus', () => {
    const f = new Fighter(0, 500, 580);
    applyKnockback(f, 10, { x: 1, y: 0 });
    expect(f.velocityX).toBe(10);
    expect(f.velocityY).toBeLessThan(0); // Upward bonus applied
    expect(f.action).toBe(FighterAction.Hitstun);
  });

  it('amplifies upward bonus when aiming up', () => {
    const f = new Fighter(0, 500, 580);
    applyKnockback(f, 10, { x: 0, y: -1 });
    expect(f.velocityY).toBeLessThan(-10); // Base -10 + amplified bonus
  });

  it('suppresses upward bonus when aiming down (spike)', () => {
    const f = new Fighter(0, 500, 580);
    applyKnockback(f, 10, { x: 0, y: 1 });
    expect(f.velocityY).toBe(10); // No bonus — spike goes straight down
  });

  it('forces minimum launch angle when grounded', () => {
    const f = new Fighter(0, 500, 580);
    applyKnockback(f, 10, { x: 1, y: 0.5 }, true); // Aiming slightly down, grounded
    expect(f.velocityY).toBeLessThan(0); // Forced upward despite downward aim
  });
});

describe('aimDirection reset', () => {
  it('resets aimDirection to facing direction on non-attack state', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    f.aimDirection = { x: 0, y: -1 };
    f.setAction(FighterAction.Hitstun);
    expect(f.aimDirection).toEqual({ x: 1, y: 0 });
  });

  it('preserves aimDirection when transitioning between attack states', () => {
    const f = new Fighter(0, 500, 580);
    f.aimDirection = { x: 0, y: -1 };
    f.action = FighterAction.ChargeHeavy;
    f.setAction(FighterAction.AttackHeavy);
    expect(f.aimDirection).toEqual({ x: 0, y: -1 });
  });

  it('resets to left when facing left', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = false;
    f.aimDirection = { x: 0, y: -1 };
    f.action = FighterAction.Airborne; // put in a different state so setAction fires
    f.setAction(FighterAction.Idle);
    expect(f.aimDirection).toEqual({ x: -1, y: 0 });
  });
});
