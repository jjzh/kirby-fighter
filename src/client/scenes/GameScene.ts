import Phaser from 'phaser';
import { GameSimulation } from '@simulation/GameSimulation';
import { STAGE, DEFAULT_MATCH, CANVAS_W, CANVAS_H, FIGHTER_H } from '@simulation/constants';
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
    const uiExtras: Phaser.GameObjects.GameObject[] = [];
    if (!this.isTouchDevice) {
      const controlsP1 = this.add.text(20, 20,
        'P1: WASD move | Space jump | J light | K heavy | L suck', {
        fontSize: '12px', color: '#666666', fontFamily: 'monospace',
      });
      const controlsP2 = this.add.text(20, 36,
        'P2: Arrows move | Shift jump | . light | , heavy | / suck', {
        fontSize: '12px', color: '#666666', fontFamily: 'monospace',
      });
      uiExtras.push(controlsP1, controlsP2);

      this.time.delayedCall(5000, () => {
        this.tweens.add({ targets: [controlsP1, controlsP2], alpha: 0, duration: 1000 });
      });
    }

    // --- Camera setup: zoomed game view + unzoomed UI overlay ---
    this.cameras.main.setZoom(1.2);
    this.cameras.main.centerOn(CANVAS_W / 2, CANVAS_H / 2);

    // Collect game-world objects for camera separation
    const gameObjects: Phaser.GameObjects.GameObject[] = [
      ...this.stageRenderer.getGameObjects(),
    ];
    for (const fr of this.fighterRenderers) {
      gameObjects.push(...fr.getGameObjects());
    }

    // Collect UI objects (HUD, touch controls, controls text)
    const uiObjects: Phaser.GameObjects.GameObject[] = [
      ...this.hudRenderer.getGameObjects(),
      ...uiExtras,
    ];
    if (this.touchInput) {
      uiObjects.push(...this.touchInput.getGameObjects());
    }

    // Main camera (zoomed): renders only game world
    this.cameras.main.ignore(uiObjects);

    // UI camera (unzoomed): renders only HUD + controls
    this.cameras.add(0, 0, CANVAS_W, CANVAS_H).ignore(gameObjects);
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

    // Mobile: camera follows local player (P1)
    if (this.isTouchDevice) {
      const p1 = snap.fighters[0];
      const cam = this.cameras.main;
      const viewW = CANVAS_W / cam.zoom;
      const viewH = CANVAS_H / cam.zoom;

      let targetX = p1.x - viewW / 2;
      let targetY = (p1.y - FIGHTER_H / 2) - viewH / 2;

      // Clamp so camera stays within the game area
      targetX = Math.max(0, Math.min(targetX, CANVAS_W - viewW));
      targetY = Math.max(-50, Math.min(targetY, CANVAS_H - viewH + 50));

      cam.scrollX += (targetX - cam.scrollX) * 0.08;
      cam.scrollY += (targetY - cam.scrollY) * 0.08;
    }

    // Check for match end
    if (snap.matchPhase === 'ended') {
      this.music.stop();
      this.scene.start('ResultScene', { winnerIndex: snap.winnerIndex });
    }
  }
}
