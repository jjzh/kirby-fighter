import { describe, it, expect } from 'vitest';
import { GameSimulation } from '../GameSimulation';
import { FighterAction, MatchPhase, NULL_INPUT } from '../types';
import { STAGE, RESPAWN_INVINCIBILITY_FRAMES, RUN_SPEED } from '../constants';

function createSim(playerCount = 2) {
  return new GameSimulation({ stocks: 3, playerCount }, STAGE);
}

describe('GameSimulation', () => {
  it('initializes with correct number of fighters', () => {
    const sim = createSim(2);
    const snap = sim.getSnapshot();
    expect(snap.fighters).toHaveLength(2);
    expect(snap.matchPhase).toBe(MatchPhase.Playing);
  });

  it('places fighters on opposite sides of stage', () => {
    const sim = createSim(2);
    const snap = sim.getSnapshot();
    expect(snap.fighters[0].x).toBeLessThan(snap.fighters[1].x);
    expect(snap.fighters[0].y).toBe(STAGE.groundY);
    expect(snap.fighters[1].y).toBe(STAGE.groundY);
  });

  it('steps simulation with input', () => {
    const sim = createSim(2);
    const inputs = [
      { ...NULL_INPUT, right: true },
      NULL_INPUT,
    ];
    sim.step(inputs);
    const snap = sim.getSnapshot();
    expect(snap.fighters[0].action).toBe(FighterAction.Run);
  });

  it('handles blast zone death and stock loss', () => {
    const sim = createSim(2);
    // Access private fighters to teleport one past blast zone
    // Use getSnapshot + step approach instead
    // We'll position fighter off stage by giving them extreme velocity
    const snap0 = sim.getSnapshot();
    // Hack: reach in to move fighter (not ideal but needed for testing)
    (sim as any).fighters[0].x = -200;
    (sim as any).fighters[0].y = -200;
    sim.step([NULL_INPUT, NULL_INPUT]);
    const snap = sim.getSnapshot();
    expect(snap.fighters[0].stocks).toBe(2);
  });

  it('detects match end when a player runs out of stocks', () => {
    const sim = createSim(2);
    (sim as any).fighters[0].stocks = 1;
    (sim as any).fighters[0].x = -200;
    sim.step([NULL_INPUT, NULL_INPUT]);
    const snap = sim.getSnapshot();
    expect(snap.matchPhase).toBe(MatchPhase.Ended);
    expect(snap.winnerIndex).toBe(1);
  });

  it('respawns dead fighter with invincibility', () => {
    const sim = createSim(2);
    (sim as any).fighters[0].x = -200;
    (sim as any).fighters[0].y = -200;
    sim.step([NULL_INPUT, NULL_INPUT]);
    const snap = sim.getSnapshot();
    if (snap.fighters[0].stocks > 0) {
      expect(snap.fighters[0].invincibleFrames).toBe(RESPAWN_INVINCIBILITY_FRAMES);
    }
  });

  it('processes light attack hit between fighters', () => {
    const sim = createSim(2);
    // Position fighters close together
    (sim as any).fighters[0].x = 500;
    (sim as any).fighters[0].y = 580;
    (sim as any).fighters[0].facingRight = true;
    (sim as any).fighters[1].x = 530;
    (sim as any).fighters[1].y = 580;

    // Start light attack
    sim.step([{ ...NULL_INPUT, light: true }, NULL_INPUT]);
    // Tick through startup frames (3 frames) + into active frames
    for (let i = 0; i < 3; i++) {
      sim.step([NULL_INPUT, NULL_INPUT]);
    }
    const snap = sim.getSnapshot();
    expect(snap.fighters[1].damage).toBeGreaterThan(0);
  });

  it('increments frame counter each step', () => {
    const sim = createSim(2);
    expect(sim.getSnapshot().frameNumber).toBe(0);
    sim.step([NULL_INPUT, NULL_INPUT]);
    expect(sim.getSnapshot().frameNumber).toBe(1);
    sim.step([NULL_INPUT, NULL_INPUT]);
    expect(sim.getSnapshot().frameNumber).toBe(2);
  });
});
