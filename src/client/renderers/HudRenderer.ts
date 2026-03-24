import Phaser from 'phaser';
import type { SimulationSnapshot } from '@simulation/types';

export class HudRenderer {
  constructor(_scene: Phaser.Scene, _playerCount: number) {}
  update(_snapshot: SimulationSnapshot): void {}
}
