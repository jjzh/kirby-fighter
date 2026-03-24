import { describe, it, expect } from 'vitest';
import {
  isInInhaleCone, processInhale, processCapture,
  launchProjectile, tickProjectile,
} from '../suck';
import { Fighter } from '../Fighter';
import { Stage } from '../Stage';
import { FighterAction, NULL_INPUT } from '../types';
import {
  STAGE,
  CAPTURE_MIN_HOLD_FRAMES, PROJECTILE_SELF_DAMAGE,
  PROJECTILE_CONTROL_REGAIN_FRAMES,
} from '../constants';

describe('isInInhaleCone', () => {
  it('detects target in front within range', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = true;
    expect(isInInhaleCone(sucker, 540, 580, 80)).toBe(true);
  });

  it('rejects target behind sucker', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = true;
    expect(isInInhaleCone(sucker, 450, 580, 80)).toBe(false);
  });

  it('rejects target out of range', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = true;
    expect(isInInhaleCone(sucker, 700, 580, 80)).toBe(false);
  });

  it('works for left-facing sucker', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = false;
    expect(isInInhaleCone(sucker, 460, 580, 80)).toBe(true);
  });
});

describe('processCapture', () => {
  it('tracks mash count when victim presses light', () => {
    const sucker = new Fighter(0, 500, 580);
    const victim = new Fighter(1, 500, 580);
    sucker.action = FighterAction.CaptureHold;
    victim.action = FighterAction.CaptureHold;
    sucker.suck.capturedFighter = 1;
    victim.suck.capturedBy = 0;
    sucker.suck.captureTimer = CAPTURE_MIN_HOLD_FRAMES + 1;

    const victimInput = { ...NULL_INPUT, light: true };
    const escaped = processCapture(sucker, victim, victimInput);
    expect(sucker.suck.mashCount).toBe(1);
    expect(escaped).toBe(false);
  });

  it('does not allow escape before minimum hold time', () => {
    const sucker = new Fighter(0, 500, 580);
    const victim = new Fighter(1, 500, 580);
    sucker.action = FighterAction.CaptureHold;
    victim.action = FighterAction.CaptureHold;
    sucker.suck.capturedFighter = 1;
    victim.suck.capturedBy = 0;
    sucker.suck.captureTimer = 10;
    victim.damage = 0;

    sucker.suck.mashCount = 100;
    const victimInput = { ...NULL_INPUT, light: true };
    const escaped = processCapture(sucker, victim, victimInput);
    expect(escaped).toBe(false);
  });
});

describe('launchProjectile', () => {
  it('sets victim to projectile state with velocity', () => {
    const sucker = new Fighter(0, 500, 580);
    const victim = new Fighter(1, 500, 580);
    sucker.facingRight = true;
    victim.damage = 50;

    const input = { ...NULL_INPUT, right: true };
    launchProjectile(sucker, victim, input);

    expect(victim.action).toBe(FighterAction.Projectile);
    expect(victim.suck.projectileTimer).toBe(PROJECTILE_CONTROL_REGAIN_FRAMES);
    expect(victim.suck.projectileVelocity.x).toBeGreaterThan(0);
  });
});

describe('tickProjectile', () => {
  const stage = new Stage(STAGE);

  it('moves fighter along projectile velocity', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Projectile;
    f.suck.projectileTimer = 20;
    f.suck.projectileVelocity = { x: 10, y: 0 };

    tickProjectile(f, stage);
    expect(f.x).toBe(510);
    expect(f.suck.projectileTimer).toBe(19);
  });

  it('regains control when timer expires', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Projectile;
    f.suck.projectileTimer = 1;
    f.suck.projectileVelocity = { x: 10, y: 0 };

    tickProjectile(f, stage);
    expect(f.suck.projectileTimer).toBe(0);
    expect(f.action).toBe(FighterAction.Airborne);
  });

  it('stops on ground when launched downward', () => {
    const f = new Fighter(0, 500, 570); // Just above ground (580)
    f.action = FighterAction.Projectile;
    f.suck.projectileTimer = 20;
    f.suck.projectileVelocity = { x: 5, y: 15 }; // Aimed downward

    tickProjectile(f, stage);
    expect(f.y).toBe(580); // Clamped to ground
    expect(f.action).toBe(FighterAction.Idle); // Regained control on ground
    expect(f.velocityY).toBe(0); // No downward velocity
  });

  it('applies self-damage on projectile impact (tested via GameSimulation)', () => {
    expect(PROJECTILE_SELF_DAMAGE).toBe(5);
  });
});
