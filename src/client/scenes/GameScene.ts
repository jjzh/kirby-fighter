import Phaser from 'phaser';
import { GameSimulation } from '@simulation/GameSimulation';
import { STAGE, DEFAULT_MATCH } from '@simulation/constants';
import { type InputState, NULL_INPUT } from '@simulation/types';
import { StageRenderer } from '../renderers/StageRenderer';
import { FighterRenderer } from '../renderers/FighterRenderer';
import { HudRenderer } from '../renderers/HudRenderer';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchInput } from '../input/TouchInput';

const STEP_MS = 1000 / 60;

export class GameScene extends Phaser.Scene {
  private simulation!: GameSimulation;
  private stageRenderer!: StageRenderer;
  private fighterRenderers: FighterRenderer[] = [];
  private hudRenderer!: HudRenderer;
  private keyboardInput!: KeyboardInput;
  private touchInput: TouchInput | null = null;
  private isTouchDevice = false;
  private accumulator = 0;
  private music!: Phaser.Sound.BaseSound;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.atlas(
      'fighter-kirby',
      'assets/fighter-kirby.png',
      'assets/fighter-kirby.json'
    );
    this.load.audio('combat-music', 'assets/audio/combat-music.mp3');
  }

  create(): void {
    // Start combat music (loop)
    this.music = this.sound.add('combat-music', { loop: true, volume: 0.5 });
    this.music.play();
    this.simulation = new GameSimulation(DEFAULT_MATCH, STAGE);
    this.stageRenderer = new StageRenderer(this);

    this.isTouchDevice = this.sys.game.device.input.touch;
    this.keyboardInput = new KeyboardInput(this, DEFAULT_MATCH.playerCount);
    if (this.isTouchDevice) {
      this.touchInput = new TouchInput(this);
    }

    const snap = this.simulation.getSnapshot();
    for (let i = 0; i < snap.fighters.length; i++) {
      this.fighterRenderers.push(new FighterRenderer(this, i));
    }
    this.hudRenderer = new HudRenderer(this, snap.fighters.length);

    // Controls reference — only show on non-touch (keyboard) devices
    if (!this.isTouchDevice) {
      const controlsP1 = this.add.text(20, 20,
        'P1: WASD move | Space jump | J light | K heavy | L suck', {
        fontSize: '12px', color: '#666666', fontFamily: 'monospace',
      });
      const controlsP2 = this.add.text(20, 36,
        'P2: Arrows move | Shift jump | . light | , heavy | / suck', {
        fontSize: '12px', color: '#666666', fontFamily: 'monospace',
      });

      this.time.delayedCall(5000, () => {
        this.tweens.add({ targets: [controlsP1, controlsP2], alpha: 0, duration: 1000 });
      });
    }
  }

  update(_time: number, delta: number): void {
    this.accumulator += delta;

    while (this.accumulator >= STEP_MS) {
      let inputs: InputState[];
      if (this.touchInput) {
        const touch = this.touchInput.getInput();
        inputs = [touch, NULL_INPUT];
      } else {
        inputs = this.keyboardInput.getInputs();
      }
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
      this.music.stop();
      this.scene.start('ResultScene', { winnerIndex: snap.winnerIndex });
    }
  }
}
