import type { StageConfig } from './types';

export class Stage {
  readonly groundLeft: number;
  readonly groundRight: number;
  readonly groundY: number;
  readonly blastZone: StageConfig['blastZone'];

  constructor(config: StageConfig) {
    this.groundLeft = config.groundLeft;
    this.groundRight = config.groundRight;
    this.groundY = config.groundY;
    this.blastZone = config.blastZone;
  }

  isInBlastZone(x: number, y: number): boolean {
    return x < this.blastZone.left || x > this.blastZone.right ||
           y < this.blastZone.top || y > this.blastZone.bottom;
  }

  isOnGround(x: number, y: number): boolean {
    return y >= this.groundY && x >= this.groundLeft && x <= this.groundRight;
  }

  clampToGround(x: number, y: number): number {
    if (x >= this.groundLeft && x <= this.groundRight && y > this.groundY) {
      return this.groundY;
    }
    return y;
  }
}
