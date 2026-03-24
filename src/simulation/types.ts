/** Input state sent per player per frame. Booleans only. */
export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  light: boolean;
  heavy: boolean;
  suck: boolean;
}

export const NULL_INPUT: InputState = {
  left: false, right: false, up: false, down: false,
  jump: false, light: false, heavy: false, suck: false,
};

export interface Vec2 {
  x: number;
  y: number;
}

export enum FighterAction {
  Idle = 'idle',
  Run = 'run',
  Airborne = 'airborne',
  AttackLight = 'attack_light',
  AttackHeavy = 'attack_heavy',
  ChargeHeavy = 'charge_heavy',
  Inhale = 'inhale',
  CaptureHold = 'capture_hold',
  Projectile = 'projectile',
  Hitstun = 'hitstun',
  Dead = 'dead',
}

/** Which phase of an attack the fighter is in */
export enum AttackPhase {
  Startup = 'startup',
  Active = 'active',
  Recovery = 'recovery',
}

export interface SuckState {
  /** Index of the fighter this one has captured, or -1 */
  capturedFighter: number;
  /** Index of the fighter capturing this one, or -1 */
  capturedBy: number;
  /** Mash count accumulated by the captured fighter */
  mashCount: number;
  /** Frames spent in capture (for minimum hold time) */
  captureTimer: number;
  /** Frames remaining as a projectile before control regain */
  projectileTimer: number;
  /** Direction of projectile travel */
  projectileVelocity: Vec2;
}

export interface Platform {
  left: number;
  right: number;
  y: number;
}

export interface StageConfig {
  /** Left edge of walkable ground (x) */
  groundLeft: number;
  /** Right edge of walkable ground (x) */
  groundRight: number;
  /** Y position of ground surface */
  groundY: number;
  /** Blast zone boundaries — crossing any kills the player */
  blastZone: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  /** Floating platforms */
  platforms: Platform[];
}

export interface MatchConfig {
  stocks: number;
  playerCount: number;
}

export enum MatchPhase {
  Countdown = 'countdown',
  Playing = 'playing',
  Ended = 'ended',
}

export interface SimulationSnapshot {
  fighters: FighterSnapshot[];
  matchPhase: MatchPhase;
  winnerIndex: number; // -1 if no winner yet
  frameNumber: number;
}

export interface FighterSnapshot {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  facingRight: boolean;
  action: FighterAction;
  actionFrame: number;
  damage: number;
  stocks: number;
  invincibleFrames: number;
  suck: SuckState;
  colorIndex: number;
  /** Whether this fighter has used their double jump */
  doubleJumpUsed: boolean;
  aimDirection: Vec2;
}
