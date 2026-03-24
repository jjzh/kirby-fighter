import { Fighter } from './Fighter';
import { Stage } from './Stage';
import { FighterAction, type InputState } from './types';
import {
  GRAVITY, MAX_FALL_SPEED, RUN_SPEED, AIR_SPEED,
  JUMP_VELOCITY, DOUBLE_JUMP_VELOCITY,
} from './constants';

const GROUNDED_ACTIONS = new Set([
  FighterAction.Idle,
  FighterAction.Run,
  FighterAction.AttackLight,
  FighterAction.AttackHeavy,
  FighterAction.Inhale,
  FighterAction.CaptureHold,
]);

/** Apply gravity to a fighter. Only affects airborne/projectile states. */
export function applyGravity(fighter: Fighter): void {
  if (!GROUNDED_ACTIONS.has(fighter.action) || fighter.velocityY !== 0) {
    fighter.velocityY = Math.min(fighter.velocityY + GRAVITY, MAX_FALL_SPEED);
  }
}

/** Process horizontal movement and position updates. */
export function processMovement(fighter: Fighter, input: InputState, stage: Stage): void {
  const isGrounded = GROUNDED_ACTIONS.has(fighter.action) && fighter.velocityY === 0;
  const isInAction = fighter.action === FighterAction.AttackLight ||
                     fighter.action === FighterAction.AttackHeavy ||
                     fighter.action === FighterAction.Hitstun ||
                     fighter.action === FighterAction.Projectile;

  // Horizontal velocity from input (only when not in attack/hitstun)
  if (!isInAction) {
    const speed = fighter.action === FighterAction.CaptureHold
      ? 2.5
      : (isGrounded ? RUN_SPEED : AIR_SPEED);

    if (input.left && !input.right) {
      fighter.velocityX = -speed;
      fighter.facingRight = false;
    } else if (input.right && !input.left) {
      fighter.velocityX = speed;
      fighter.facingRight = true;
    } else if (isGrounded) {
      fighter.velocityX = 0;
    }
  }

  // Apply velocity to position
  fighter.x += fighter.velocityX;
  fighter.y += fighter.velocityY;

  // Ground collision
  if (stage.isOnGround(fighter.x, fighter.y) && fighter.velocityY >= 0) {
    fighter.y = stage.clampToGround(fighter.x, fighter.y);
    fighter.velocityY = 0;
    fighter.doubleJumpUsed = false;

    if (fighter.action === FighterAction.Airborne) {
      fighter.setAction(fighter.velocityX !== 0 ? FighterAction.Run : FighterAction.Idle);
    }
  } else if (!stage.isOnGround(fighter.x, fighter.y) && isGrounded) {
    fighter.setAction(FighterAction.Airborne);
  }

  // Update idle/run transitions on ground
  if (isGrounded && fighter.action !== FighterAction.Airborne && !isInAction) {
    if (fighter.action === FighterAction.Inhale || fighter.action === FighterAction.CaptureHold) {
      // Don't override suck states
    } else if (fighter.velocityX !== 0) {
      fighter.setAction(FighterAction.Run);
    } else {
      fighter.setAction(FighterAction.Idle);
    }
  }
}

/** Process jump input. Uses edge detection (only triggers on fresh press). */
export function processJump(fighter: Fighter, input: InputState, stage: Stage): void {
  const justPressed = input.jump && !fighter.prevJumpPressed;

  if (!justPressed) return;

  const canJump = fighter.action === FighterAction.Idle ||
                  fighter.action === FighterAction.Run ||
                  fighter.action === FighterAction.Airborne ||
                  fighter.action === FighterAction.CaptureHold;
  if (!canJump) return;

  const isGrounded = stage.isOnGround(fighter.x, fighter.y) &&
                     fighter.action !== FighterAction.Airborne;

  // Half-height jump while holding a captured fighter
  const holdingEnemy = fighter.action === FighterAction.CaptureHold;
  const jumpVel = holdingEnemy ? JUMP_VELOCITY / 2 : JUMP_VELOCITY;
  const doubleJumpVel = holdingEnemy ? DOUBLE_JUMP_VELOCITY / 2 : DOUBLE_JUMP_VELOCITY;

  if (isGrounded) {
    fighter.velocityY = jumpVel;
    if (!holdingEnemy) {
      fighter.setAction(FighterAction.Airborne);
    }
  } else if (!fighter.doubleJumpUsed && (fighter.action === FighterAction.Airborne || holdingEnemy)) {
    fighter.velocityY = doubleJumpVel;
    fighter.doubleJumpUsed = true;
  }
}
