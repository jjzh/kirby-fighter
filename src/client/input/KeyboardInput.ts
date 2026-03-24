import Phaser from 'phaser';
import { type InputState, NULL_INPUT } from '@simulation/types';

export class KeyboardInput {
  constructor(_scene: Phaser.Scene, _playerCount: number) {}
  getInputs(): InputState[] { return [NULL_INPUT, NULL_INPUT]; }
}
