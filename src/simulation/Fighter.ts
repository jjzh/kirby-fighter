import { FighterAction, type FighterSnapshot, type SuckState } from './types';
import { DEFAULT_MATCH } from './constants';

function createSuckState(): SuckState {
  return {
    capturedFighter: -1,
    capturedBy: -1,
    mashCount: 0,
    captureTimer: 0,
    projectileTimer: 0,
    projectileVelocity: { x: 0, y: 0 },
  };
}

export class Fighter {
  readonly colorIndex: number;
  x: number;
  y: number;
  velocityX = 0;
  velocityY = 0;
  facingRight = true;
  action: FighterAction = FighterAction.Idle;
  actionFrame = 0;
  damage = 0;
  stocks: number;
  invincibleFrames = 0;
  doubleJumpUsed = false;
  suck: SuckState;

  prevJumpPressed = false;
  prevLightPressed = false;
  prevHeavyPressed = false;
  prevSuckPressed = false;

  constructor(colorIndex: number, x: number, y: number, stocks = DEFAULT_MATCH.stocks) {
    this.colorIndex = colorIndex;
    this.x = x;
    this.y = y;
    this.stocks = stocks;
    this.suck = createSuckState();
  }

  setAction(action: FighterAction): void {
    if (this.action !== action) {
      this.action = action;
      this.actionFrame = 0;
    }
  }

  tickActionFrame(): void {
    this.actionFrame++;
  }

  isGrounded(): boolean {
    return this.action !== FighterAction.Airborne &&
           this.action !== FighterAction.Projectile &&
           this.velocityY === 0;
  }

  resetSuckState(): void {
    this.suck = createSuckState();
  }

  respawn(x: number, y: number, invincibleFrames: number): void {
    this.x = x;
    this.y = y;
    this.velocityX = 0;
    this.velocityY = 0;
    this.damage = 0;
    this.action = FighterAction.Airborne;
    this.actionFrame = 0;
    this.invincibleFrames = invincibleFrames;
    this.doubleJumpUsed = false;
    this.resetSuckState();
  }

  snapshot(): FighterSnapshot {
    return {
      x: this.x,
      y: this.y,
      velocityX: this.velocityX,
      velocityY: this.velocityY,
      facingRight: this.facingRight,
      action: this.action,
      actionFrame: this.actionFrame,
      damage: this.damage,
      stocks: this.stocks,
      invincibleFrames: this.invincibleFrames,
      suck: { ...this.suck, projectileVelocity: { ...this.suck.projectileVelocity } },
      colorIndex: this.colorIndex,
      doubleJumpUsed: this.doubleJumpUsed,
    };
  }
}
