import { describe, it, expect } from 'vitest';
import { applyGravity, processMovement, processJump } from '../movement';
import { Fighter } from '../Fighter';
import { Stage } from '../Stage';
import { FighterAction, NULL_INPUT } from '../types';
import { STAGE, GRAVITY, MAX_FALL_SPEED, RUN_SPEED, JUMP_VELOCITY } from '../constants';

describe('applyGravity', () => {
  it('increases downward velocity each frame', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    applyGravity(f);
    expect(f.velocityY).toBeCloseTo(GRAVITY);
  });

  it('caps fall speed at MAX_FALL_SPEED', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    f.velocityY = MAX_FALL_SPEED;
    applyGravity(f);
    expect(f.velocityY).toBe(MAX_FALL_SPEED);
  });

  it('does not apply gravity when grounded and idle', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    f.velocityY = 0;
    applyGravity(f);
    expect(f.velocityY).toBe(0);
  });
});

describe('processMovement', () => {
  const stage = new Stage(STAGE);

  it('moves right when right input held', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, right: true };
    processMovement(f, input, stage);
    expect(f.x).toBe(500 + RUN_SPEED);
    expect(f.facingRight).toBe(true);
    expect(f.action).toBe(FighterAction.Run);
  });

  it('moves left when left input held', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, left: true };
    processMovement(f, input, stage);
    expect(f.x).toBe(500 - RUN_SPEED);
    expect(f.facingRight).toBe(false);
  });

  it('returns to idle when no horizontal input on ground', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Run;
    processMovement(f, NULL_INPUT, stage);
    expect(f.action).toBe(FighterAction.Idle);
  });

  it('lands when reaching ground', () => {
    const f = new Fighter(0, 500, 578);
    f.action = FighterAction.Airborne;
    f.velocityY = 5;
    processMovement(f, NULL_INPUT, stage);
    expect(f.y).toBe(580);
    expect(f.velocityY).toBe(0);
    expect(f.action).toBe(FighterAction.Idle);
  });

  it('transitions to airborne when walking off edge', () => {
    const f = new Fighter(0, 201, 580);
    f.action = FighterAction.Run;
    const input = { ...NULL_INPUT, left: true };
    processMovement(f, input, stage);
    expect(f.x).toBe(201 - RUN_SPEED);
    expect(f.action).toBe(FighterAction.Airborne);
  });

  it('applies position from velocity', () => {
    const f = new Fighter(0, 500, 300);
    f.action = FighterAction.Airborne;
    f.velocityY = 5;
    processMovement(f, NULL_INPUT, stage);
    expect(f.y).toBe(305);
  });
});

describe('processJump', () => {
  const stage = new Stage(STAGE);

  it('jumps from ground on fresh press', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    expect(f.velocityY).toBe(JUMP_VELOCITY);
    expect(f.action).toBe(FighterAction.Airborne);
  });

  it('does not jump when jump is held from previous frame', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    f.prevJumpPressed = true;
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    expect(f.velocityY).toBe(0);
  });

  it('double jumps in air', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    f.doubleJumpUsed = false;
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    expect(f.velocityY).toBeLessThan(0);
    expect(f.doubleJumpUsed).toBe(true);
  });

  it('cannot triple jump', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    f.doubleJumpUsed = true;
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    expect(f.velocityY).toBe(0);
  });

  it('resets double jump on landing', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    f.doubleJumpUsed = true;
    expect(f.doubleJumpUsed).toBe(true);
  });
});
