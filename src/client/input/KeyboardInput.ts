import Phaser from 'phaser';
import { type InputState, NULL_INPUT } from '@simulation/types';

/**
 * Player 1: WASD + Space + JKL
 * Player 2: Arrows + RightShift + . , /
 */
export class KeyboardInput {
  private scene: Phaser.Scene;
  private playerCount: number;

  // Player 1 keys
  private p1Left!: Phaser.Input.Keyboard.Key;
  private p1Right!: Phaser.Input.Keyboard.Key;
  private p1Up!: Phaser.Input.Keyboard.Key;
  private p1Down!: Phaser.Input.Keyboard.Key;
  private p1Jump!: Phaser.Input.Keyboard.Key;
  private p1Light!: Phaser.Input.Keyboard.Key;
  private p1Heavy!: Phaser.Input.Keyboard.Key;
  private p1Suck!: Phaser.Input.Keyboard.Key;

  // Player 2 keys
  private p2Left!: Phaser.Input.Keyboard.Key;
  private p2Right!: Phaser.Input.Keyboard.Key;
  private p2Up!: Phaser.Input.Keyboard.Key;
  private p2Down!: Phaser.Input.Keyboard.Key;
  private p2Jump!: Phaser.Input.Keyboard.Key;
  private p2Light!: Phaser.Input.Keyboard.Key;
  private p2Heavy!: Phaser.Input.Keyboard.Key;
  private p2Suck!: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, playerCount: number) {
    this.scene = scene;
    this.playerCount = playerCount;

    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;

    // Player 1: WASD + Space + JKL
    this.p1Left = kb.addKey(K.A);
    this.p1Right = kb.addKey(K.D);
    this.p1Up = kb.addKey(K.W);
    this.p1Down = kb.addKey(K.S);
    this.p1Jump = kb.addKey(K.SPACE);
    this.p1Light = kb.addKey(K.J);
    this.p1Heavy = kb.addKey(K.K);
    this.p1Suck = kb.addKey(K.L);

    // Player 2: Arrows + RightShift + Period/Comma/ForwardSlash
    this.p2Left = kb.addKey(K.LEFT);
    this.p2Right = kb.addKey(K.RIGHT);
    this.p2Up = kb.addKey(K.UP);
    this.p2Down = kb.addKey(K.DOWN);
    this.p2Jump = kb.addKey(K.SHIFT);
    this.p2Light = kb.addKey(K.PERIOD);
    this.p2Heavy = kb.addKey(K.COMMA);
    this.p2Suck = kb.addKey(K.FORWARD_SLASH);
  }

  getInputs(): InputState[] {
    const p1: InputState = {
      left: this.p1Left.isDown,
      right: this.p1Right.isDown,
      up: this.p1Up.isDown,
      down: this.p1Down.isDown,
      jump: this.p1Jump.isDown,
      light: this.p1Light.isDown,
      heavy: this.p1Heavy.isDown,
      suck: this.p1Suck.isDown,
    };

    if (this.playerCount < 2) return [p1];

    const p2: InputState = {
      left: this.p2Left.isDown,
      right: this.p2Right.isDown,
      up: this.p2Up.isDown,
      down: this.p2Down.isDown,
      jump: this.p2Jump.isDown,
      light: this.p2Light.isDown,
      heavy: this.p2Heavy.isDown,
      suck: this.p2Suck.isDown,
    };

    return [p1, p2];
  }
}
