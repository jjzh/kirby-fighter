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
    expect(stage.isOnGround(500, STAGE.groundY)).toBe(true);
  });

  it('reports grounded when below ground Y', () => {
    expect(stage.isOnGround(500, STAGE.groundY + 10)).toBe(true);
  });

  it('reports not grounded when above ground', () => {
    expect(stage.isOnGround(500, STAGE.groundY - 1)).toBe(false);
  });

  it('reports not grounded when past stage edges (walking off)', () => {
    expect(stage.isOnGround(STAGE.groundLeft - 1, STAGE.groundY)).toBe(false);
    expect(stage.isOnGround(STAGE.groundRight + 1, STAGE.groundY)).toBe(false);
  });

  it('clamps Y to ground level', () => {
    expect(stage.clampToGround(500, STAGE.groundY + 20)).toBe(STAGE.groundY);
    expect(stage.clampToGround(500, STAGE.groundY)).toBe(STAGE.groundY);
    expect(stage.clampToGround(500, 400)).toBe(400);
  });
});
