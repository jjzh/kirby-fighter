import Phaser from 'phaser';
import { GameSimulation } from '@simulation/GameSimulation';
import { STAGE, DEFAULT_MATCH } from '@simulation/constants';
import { type InputState, NULL_INPUT } from '@simulation/types';
import { StageRenderer } from '../renderers/StageRenderer';
import { FighterRenderer } from '../renderers/FighterRenderer';
import { HudRenderer } from '../renderers/HudRenderer';
import { KeyboardInput } from '../input/KeyboardInput';

const STEP_MS = 1000 / 60;

export class GameScene extends Phaser.Scene {
  private simulation!: GameSimulation;
  private stageRenderer!: StageRenderer;
  private fighterRenderers: FighterRenderer[] = [];
  private hudRenderer!: HudRenderer;
  private keyboardInput!: KeyboardInput;
  private accumulator = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.simulation = new GameSimulation(DEFAULT_MATCH, STAGE);
    this.stageRenderer = new StageRenderer(this);
    this.keyboardInput = new KeyboardInput(this, DEFAULT_MATCH.playerCount);

    const snap = this.simulation.getSnapshot();
    for (let i = 0; i < snap.fighters.length; i++) {
      this.fighterRenderers.push(new FighterRenderer(this, i));
    }
    this.hudRenderer = new HudRenderer(this, snap.fighters.length);

    // Controls reference (shown at start, fades out)
    const controlsP1 = this.add.text(20, 20,
      'P1: WASD move | Space jump | J light | K heavy | L suck', {
      fontSize: '12px', color: '#666666', fontFamily: 'monospace',
    });
    const controlsP2 = this.add.text(20, 36,
      'P2: Arrows move | Shift jump | . light | , heavy | / suck', {
      fontSize: '12px', color: '#666666', fontFamily: 'monospace',
    });

    // Fade out after 5 seconds
    this.time.delayedCall(5000, () => {
      this.tweens.add({ targets: [controlsP1, controlsP2], alpha: 0, duration: 1000 });
    });
  }

  update(_time: number, delta: number): void {
    this.accumulator += delta;

    while (this.accumulator >= STEP_MS) {
      const inputs = this.keyboardInput.getInputs();
      this.simulation.step(inputs);
      this.accumulator -= STEP_MS;
    }

    // Render current state
    const snap = this.simulation.getSnapshot();
    for (let i = 0; i < snap.fighters.length; i++) {
      this.fighterRenderers[i].update(snap.fighters[i]);
    }
    this.hudRenderer.update(snap);

    // Check for match end
    if (snap.matchPhase === 'ended') {
      this.scene.start('ResultScene', { winnerIndex: snap.winnerIndex });
    }
  }
}
