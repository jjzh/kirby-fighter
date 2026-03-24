import { describe, it, expect } from 'vitest';
import { Fighter } from '../Fighter';
import { FighterAction } from '../types';

describe('Fighter', () => {
  it('initializes with correct defaults', () => {
    const f = new Fighter(0, 500, 580);
    expect(f.x).toBe(500);
    expect(f.y).toBe(580);
    expect(f.velocityX).toBe(0);
    expect(f.velocityY).toBe(0);
    expect(f.action).toBe(FighterAction.Idle);
    expect(f.damage).toBe(0);
    expect(f.stocks).toBe(3);
    expect(f.facingRight).toBe(true);
  });

  it('tracks action frame counter', () => {
    const f = new Fighter(0, 500, 580);
    f.setAction(FighterAction.AttackLight);
    expect(f.actionFrame).toBe(0);
    f.tickActionFrame();
    expect(f.actionFrame).toBe(1);
    f.tickActionFrame();
    expect(f.actionFrame).toBe(2);
  });

  it('resets action frame on state change', () => {
    const f = new Fighter(0, 500, 580);
    f.setAction(FighterAction.AttackLight);
    f.tickActionFrame();
    f.tickActionFrame();
    f.setAction(FighterAction.Idle);
    expect(f.actionFrame).toBe(0);
  });

  it('creates a snapshot of current state', () => {
    const f = new Fighter(0, 500, 580);
    f.damage = 42;
    const snap = f.snapshot();
    expect(snap.x).toBe(500);
    expect(snap.damage).toBe(42);
    expect(snap.colorIndex).toBe(0);
  });

  it('initializes suck state correctly', () => {
    const f = new Fighter(0, 500, 580);
    expect(f.suck.capturedFighter).toBe(-1);
    expect(f.suck.capturedBy).toBe(-1);
    expect(f.suck.mashCount).toBe(0);
  });
});
