import Phaser from 'phaser';
import { GameSimulation } from '@simulation/GameSimulation';
import { STAGE, DEFAULT_MATCH } from '@simulation/constants';
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
  private ost?: Phaser.Sound.BaseSound;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image('arena-bg', 'assets/arena-bg.png');
    this.load.audio('ost', 'assets/audio/ost.mp3');
    this.load.audio('sfx_punch', 'assets/sfx/punch.mp3');
    this.load.audio('sfx_punch_alt', 'assets/sfx/punch_alt.mp3');
    this.load.audio('sfx_suck_whoosh', 'assets/sfx/suck_whoosh.mp3');
    this.load.atlas(
      'fighter-kirby',
      'assets/fighter-kirby.png',
      'assets/fighter-kirby.json'
    );
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

    this.ost = this.sound.get('ost') ?? this.sound.add('ost', { loop: true, volume: 0.35 });
    this.ost.setLoop(true);
    this.ost.setVolume(0.35);
    const startOst = () => {
      if (!this.ost || this.ost.isPlaying) return;
      this.ost.play();
    };
    startOst();
    this.sound.once(Phaser.Sound.Events.UNLOCKED, startOst);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, startOst);
    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, startOst);
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
    for (const hit of snap.hitEvents) {
      FighterRenderer.spawnHitEffect(this, hit.x, hit.y);
    }
    this.hudRenderer.update(snap);

    // Check for match end
    if (snap.matchPhase === 'ended') {
      this.scene.start('ResultScene', { winnerIndex: snap.winnerIndex });
    }
  }
}
