import type { StageConfig, MatchConfig } from './types';

// -- Canvas --
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

// -- Stage --
// Stage dimensions
const STAGE_LEFT = 200;
const STAGE_RIGHT = 1080;
const STAGE_WIDTH = STAGE_RIGHT - STAGE_LEFT;
const STAGE_CENTER = (STAGE_LEFT + STAGE_RIGHT) / 2;
const PLATFORM_WIDTH = Math.floor(STAGE_WIDTH / 3);
const PLATFORM_Y = 440; // ~140px above ground (580)
const PLATFORM_SPACING = STAGE_WIDTH / 4; // Equal spacing from center

export const STAGE: StageConfig = {
  groundLeft: STAGE_LEFT,
  groundRight: STAGE_RIGHT,
  groundY: 580,
  blastZone: {
    left: -100,
    right: 1380,
    top: -100,
    bottom: 820,
  },
  platforms: [
    {
      left: STAGE_CENTER - PLATFORM_SPACING - PLATFORM_WIDTH / 2,
      right: STAGE_CENTER - PLATFORM_SPACING + PLATFORM_WIDTH / 2,
      y: PLATFORM_Y,
    },
    {
      left: STAGE_CENTER + PLATFORM_SPACING - PLATFORM_WIDTH / 2,
      right: STAGE_CENTER + PLATFORM_SPACING + PLATFORM_WIDTH / 2,
      y: PLATFORM_Y,
    },
  ],
};

export const DEFAULT_MATCH: MatchConfig = {
  stocks: 3,
  playerCount: 2,
};

// -- Fighter dimensions --
export const FIGHTER_W = 40;
export const FIGHTER_H = 48;

// -- Physics --
export const GRAVITY = 0.48;
export const MAX_FALL_SPEED = 12;
export const RUN_SPEED = 5;
export const AIR_SPEED = 4;
export const JUMP_VELOCITY = -12;
export const DOUBLE_JUMP_VELOCITY = -11;

// -- Light Attack --
export const LIGHT_STARTUP_FRAMES = 3;
export const LIGHT_ACTIVE_FRAMES = 3;
export const LIGHT_RECOVERY_FRAMES = 6;
export const LIGHT_DAMAGE = 5;
export const LIGHT_BASE_KNOCKBACK = 3;
export const LIGHT_KNOCKBACK_SCALING = 0.08;
export const LIGHT_HITBOX_W = 40;
export const LIGHT_HITBOX_H = 35;
export const LIGHT_HITBOX_OFFSET_X = 25;

// -- Heavy Attack --
export const HEAVY_STARTUP_FRAMES = 8;
export const HEAVY_ACTIVE_FRAMES = 4;
export const HEAVY_RECOVERY_FRAMES = 12;
export const HEAVY_DAMAGE = 14;
export const HEAVY_BASE_KNOCKBACK = 6;
export const HEAVY_KNOCKBACK_SCALING = 0.15;
export const HEAVY_HITBOX_W = 58;
export const HEAVY_HITBOX_H = 40;
export const HEAVY_HITBOX_OFFSET_X = 30;

// -- Heavy Charge --
export const HEAVY_CHARGE_MIN_MULTIPLIER = 0.7; // 30% lower at no charge
export const HEAVY_CHARGE_MAX_FRAMES = 60; // Full charge at 1 second

// -- Knockback --
export const HITSTUN_MULTIPLIER = 3;
export const KNOCKBACK_UPWARD_BONUS = -3.5; // Flat upward velocity added to all knockback
export const KNOCKBACK_UP_AIM_BONUS_MULT = 1.5; // Bonus amplified when aiming up
export const KNOCKBACK_DOWN_AIM_BONUS_MULT = 0; // Bonus suppressed when aiming down (spikes)
export const KNOCKBACK_MIN_LAUNCH_ANGLE = Math.PI / 9; // ~20° minimum when grounded

// -- Suck Mechanic --
export const INHALE_CONE_HALF_ANGLE = Math.PI / 6;
export const INHALE_RAMP_FRAMES = 30; // Cone grows over 0.5 seconds
export const INHALE_MIN_RANGE = 80; // Starting range (inner cone)
export const INHALE_MAX_RANGE = 160; // Maximum range (middle cone)
export const INHALE_PULL_SPEED = 4;
export const CAPTURE_MOVE_SPEED = 2.5;
export const CAPTURE_MIN_HOLD_FRAMES = 60;
export const PROJECTILE_SELF_DAMAGE = 5;
export const PROJECTILE_CONTROL_REGAIN_FRAMES = 30;
export const PROJECTILE_IMPACT_KNOCKBACK_BASE = 5;
export const PROJECTILE_IMPACT_KNOCKBACK_SCALING = 0.12;
export const CAPTURE_DISTANCE = 30;
export const SUCK_SHIELD_MAX = 4;

export const SUCK_RANGE_TABLE = [
  { percent: 0, value: 80 },
  { percent: 50, value: 160 },
  { percent: 100, value: 400 },
];

export const SUCK_MASH_TABLE = [
  { percent: 0, value: 5 },
  { percent: 50, value: 10 },
  { percent: 100, value: 15 },
];

export const SUCK_LAUNCH_SPEED_TABLE = [
  { percent: 0, value: 5.6 },
  { percent: 50, value: 9.8 },
  { percent: 100, value: 14 },
];

/** Linearly interpolate a scaling table by damage percent */
export function lookupScaling(table: { percent: number; value: number }[], damage: number): number {
  if (damage <= table[0].percent) return table[0].value;
  if (damage >= table[table.length - 1].percent) return table[table.length - 1].value;
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (damage >= a.percent && damage <= b.percent) {
      const t = (damage - a.percent) / (b.percent - a.percent);
      return a.value + t * (b.value - a.value);
    }
  }
  return table[table.length - 1].value;
}

// -- Respawn --
export const RESPAWN_INVINCIBILITY_FRAMES = 120;
export const RESPAWN_X = (STAGE.groundLeft + STAGE.groundRight) / 2;
export const RESPAWN_Y = STAGE.groundY - 200;

// -- Player Colors --
export const PLAYER_COLORS = [
  0xFF69B4, // P1: Pink
  0x4169E1, // P2: Blue
  0x32CD32, // P3: Green
  0xFFD700, // P4: Yellow
];
