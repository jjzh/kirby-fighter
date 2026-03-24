import { Fighter } from './Fighter';
import { FighterAction, type InputState, type Vec2 } from './types';
import { getAimDirection } from './combat';
import {
  INHALE_CONE_HALF_ANGLE, INHALE_PULL_SPEED, CAPTURE_DISTANCE,
  CAPTURE_MIN_HOLD_FRAMES, PROJECTILE_SELF_DAMAGE,
  PROJECTILE_CONTROL_REGAIN_FRAMES,
  SUCK_RANGE_TABLE, SUCK_MASH_TABLE, SUCK_LAUNCH_SPEED_TABLE,
  lookupScaling,
} from './constants';

export function isInInhaleCone(
  sucker: Fighter, targetX: number, targetY: number, range: number
): boolean {
  const dx = targetX - sucker.x;
  const dy = targetY - sucker.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > range || dist < 1) return false;
  const facingX = sucker.facingRight ? 1 : -1;
  const dot = dx * facingX;
  const angle = Math.acos(dot / dist);
  return angle <= INHALE_CONE_HALF_ANGLE;
}

export function processInhale(
  sucker: Fighter, fighters: Fighter[], suckerIndex: number
): number {
  for (let i = 0; i < fighters.length; i++) {
    if (i === suckerIndex) continue;
    const target = fighters[i];
    if (target.action === FighterAction.Dead) continue;
    if (target.invincibleFrames > 0) continue;
    if (target.suck.capturedBy >= 0) continue;

    const range = lookupScaling(SUCK_RANGE_TABLE, target.damage);
    if (!isInInhaleCone(sucker, target.x, target.y, range)) continue;

    const dx = sucker.x - target.x;
    const dy = sucker.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= CAPTURE_DISTANCE) {
      return i;
    }

    const pullX = (dx / dist) * INHALE_PULL_SPEED;
    const pullY = (dy / dist) * INHALE_PULL_SPEED;
    target.x += pullX;
    target.y += pullY;
  }
  return -1;
}

export function startCapture(sucker: Fighter, victim: Fighter, victimIndex: number, suckerIndex: number): void {
  sucker.setAction(FighterAction.CaptureHold);
  sucker.suck.capturedFighter = victimIndex;
  sucker.suck.mashCount = 0;
  sucker.suck.captureTimer = 0;

  victim.setAction(FighterAction.CaptureHold);
  victim.suck.capturedBy = suckerIndex;
  victim.x = sucker.x;
  victim.y = sucker.y;
  victim.velocityX = 0;
  victim.velocityY = 0;
}

export function processCapture(
  sucker: Fighter, victim: Fighter, victimInput: InputState
): boolean {
  sucker.suck.captureTimer++;
  victim.x = sucker.x;
  victim.y = sucker.y;

  if (victimInput.light && !victim.prevLightPressed) {
    sucker.suck.mashCount++;
  }

  if (sucker.suck.captureTimer < CAPTURE_MIN_HOLD_FRAMES) {
    return false;
  }

  const mashThreshold = lookupScaling(SUCK_MASH_TABLE, victim.damage);
  return sucker.suck.mashCount >= mashThreshold;
}

export function releaseCapture(sucker: Fighter, victim: Fighter): void {
  sucker.setAction(FighterAction.Idle);
  sucker.resetSuckState();
  victim.setAction(FighterAction.Airborne);
  victim.resetSuckState();
  victim.x = sucker.x + (sucker.facingRight ? 50 : -50);
}

export function launchProjectile(
  sucker: Fighter, victim: Fighter, suckerInput: InputState
): void {
  const direction = getAimDirection(suckerInput, sucker.facingRight);
  const speed = lookupScaling(SUCK_LAUNCH_SPEED_TABLE, victim.damage);

  victim.setAction(FighterAction.Projectile);
  victim.suck.capturedBy = -1;
  victim.suck.projectileTimer = PROJECTILE_CONTROL_REGAIN_FRAMES;
  victim.suck.projectileVelocity = {
    x: direction.x * speed,
    y: direction.y * speed,
  };
  victim.x = sucker.x + direction.x * 50;
  victim.y = sucker.y + direction.y * 50;

  sucker.setAction(FighterAction.Idle);
  sucker.resetSuckState();
}

export function tickProjectile(fighter: Fighter): void {
  if (fighter.action !== FighterAction.Projectile) return;
  fighter.x += fighter.suck.projectileVelocity.x;
  fighter.y += fighter.suck.projectileVelocity.y;
  fighter.suck.projectileTimer--;

  if (fighter.suck.projectileTimer <= 0) {
    fighter.velocityX = fighter.suck.projectileVelocity.x * 0.3;
    fighter.velocityY = fighter.suck.projectileVelocity.y * 0.3;
    fighter.setAction(FighterAction.Airborne);
    fighter.resetSuckState();
  }
}

export function checkProjectileImpact(
  projectile: Fighter, target: Fighter
): boolean {
  if (projectile.action !== FighterAction.Projectile) return false;
  if (target.action === FighterAction.Dead) return false;
  if (target.invincibleFrames > 0) return false;
  if (target.suck.capturedBy >= 0) return false;

  const dx = projectile.x - target.x;
  const dy = projectile.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < 40;
}

export function applyProjectileImpact(
  projectile: Fighter, target: Fighter
): void {
  const speed = Math.sqrt(
    projectile.suck.projectileVelocity.x ** 2 +
    projectile.suck.projectileVelocity.y ** 2
  );

  const impactDamage = speed * 0.8;
  target.damage += impactDamage;

  const dir: Vec2 = {
    x: projectile.suck.projectileVelocity.x / speed,
    y: projectile.suck.projectileVelocity.y / speed,
  };
  const knockback = 5 + target.damage * 0.12;
  target.velocityX = dir.x * knockback;
  target.velocityY = dir.y * knockback;
  target.setAction(FighterAction.Hitstun);

  projectile.damage += PROJECTILE_SELF_DAMAGE;
  projectile.velocityX = 0;
  projectile.velocityY = 0;
  projectile.setAction(FighterAction.Airborne);
  projectile.resetSuckState();
}
