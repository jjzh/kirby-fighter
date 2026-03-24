import { describe, it, expect } from 'vitest';
import { Stage } from '../Stage';
import { STAGE } from '../constants';

describe('Stage', () => {
  const stage = new Stage(STAGE);

  it('detects position inside blast zone boundaries as alive', () => {
    expect(stage.isInBlastZone(640, 400)).toBe(false);
  });

  it('detects position past left blast zone', () => {
    expect(stage.isInBlastZone(-101, 400)).toBe(true);
  });

  it('detects position past right blast zone', () => {
    expect(stage.isInBlastZone(1381, 400)).toBe(true);
  });

  it('detects position past top blast zone', () => {
    expect(stage.isInBlastZone(640, -101)).toBe(true);
  });

  it('detects position past bottom blast zone', () => {
    expect(stage.isInBlastZone(640, 821)).toBe(true);
  });

  it('reports grounded when at ground Y', () => {
    expect(stage.isOnGround(500, 580)).toBe(true);
  });

  it('reports grounded when below ground Y', () => {
    expect(stage.isOnGround(500, 590)).toBe(true);
  });

  it('reports not grounded when above ground', () => {
    expect(stage.isOnGround(500, 500)).toBe(false);
  });

  it('reports not grounded when past stage edges (walking off)', () => {
    expect(stage.isOnGround(100, 580)).toBe(false);
    expect(stage.isOnGround(1200, 580)).toBe(false);
  });

  it('clamps Y to ground level', () => {
    expect(stage.clampToGround(500, 600)).toBe(580);
    expect(stage.clampToGround(500, 580)).toBe(580);
    expect(stage.clampToGround(500, 400)).toBe(400);
  });
});
