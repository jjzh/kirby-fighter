import type { StageConfig, Platform } from './types';

export class Stage {
  readonly groundLeft: number;
  readonly groundRight: number;
  readonly groundY: number;
  readonly blastZone: StageConfig['blastZone'];
  readonly platforms: Platform[];

  constructor(config: StageConfig) {
    this.groundLeft = config.groundLeft;
    this.groundRight = config.groundRight;
    this.groundY = config.groundY;
    this.blastZone = config.blastZone;
    this.platforms = config.platforms ?? [];
  }

  isInBlastZone(x: number, y: number): boolean {
    return x < this.blastZone.left || x > this.blastZone.right ||
           y < this.blastZone.top || y > this.blastZone.bottom;
  }

  /** Check if fighter is on the main ground */
  isOnGround(x: number, y: number): boolean {
    if (y >= this.groundY && x >= this.groundLeft && x <= this.groundRight) {
      return true;
    }
    // Check platforms — only land from above (y at or just past platform surface)
    for (const p of this.platforms) {
      if (x >= p.left && x <= p.right && y >= p.y && y <= p.y + 8) {
        return true;
      }
    }
    return false;
  }

  clampToGround(x: number, y: number): number {
    // Check platforms first (higher priority — fighter lands on closest surface above)
    for (const p of this.platforms) {
      if (x >= p.left && x <= p.right && y >= p.y && y <= p.y + 8) {
        return p.y;
      }
    }
    if (x >= this.groundLeft && x <= this.groundRight && y > this.groundY) {
      return this.groundY;
    }
    return y;
  }
}
