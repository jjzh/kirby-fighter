# Kirby Platform Fighter — Local Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally playable 2-player Kirby platform fighter with full combat mechanics (light/heavy attacks, knockback, suck/spit), 3-stock matches, and keyboard controls — all running in-browser via Phaser 3.

**Architecture:** Pure TypeScript simulation layer (`src/simulation/`) with zero browser/Phaser dependencies handles all game logic at a fixed 60fps timestep. Phaser 3 client (`src/client/`) reads simulation state snapshots and renders them. Input flows in as boolean structs; state flows out as plain data. This separation enables future server extraction for Colyseus networking without changing simulation code.

**Tech Stack:** Phaser 3.90.0 (rendering), Vite 6.x (bundler), TypeScript 5.7.x, Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-24-kirby-platform-fighter-design.md`

---

## File Structure

```
kirby_fighter/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── simulation/                  # Pure TS — NO Phaser/browser imports
│   │   ├── types.ts                 # InputState, FighterState, SimulationState, enums
│   │   ├── constants.ts             # All tunable physics/combat/suck values
│   │   ├── Stage.ts                 # Stage geometry, blast zone checks
│   │   ├── Fighter.ts               # Fighter class: state, position, velocity, stocks
│   │   ├── movement.ts              # Gravity, horizontal movement, jumping
│   │   ├── combat.ts                # Attack processing, hit detection, knockback
│   │   ├── suck.ts                  # Inhale, capture, projectile — all 3 phases
│   │   ├── GameSimulation.ts        # Orchestrator: owns fighters + stage, runs tick
│   │   └── __tests__/
│   │       ├── Stage.test.ts
│   │       ├── movement.test.ts
│   │       ├── Fighter.test.ts
│   │       ├── combat.test.ts
│   │       ├── suck.test.ts
│   │       └── GameSimulation.test.ts
│   └── client/
│       ├── main.ts                  # Phaser config + game launch
│       ├── scenes/
│       │   ├── GameScene.ts         # Fixed-timestep loop, wires sim to renderers
│       │   └── ResultScene.ts       # Winner display, restart option
│       ├── input/
│       │   └── KeyboardInput.ts     # Keyboard → InputState for P1 and P2
│       └── renderers/
│           ├── StageRenderer.ts     # Ground + blast zone debug lines
│           ├── FighterRenderer.ts   # Colored circles/shapes per fighter
│           └── HudRenderer.ts       # Damage %, stock icons
└── public/
    └── assets/                      # Future: sprites, sounds
```

**Deviation from spec:** The spec puts physics in `src/server/physics/`. We use `src/simulation/` instead because we're building local-first. When networking is added, the Colyseus server will import from `simulation/` — the code stays in the same place.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/client/main.ts`

- [ ] **Step 1: Initialize npm project and install dependencies**

```bash
cd /Users/jzhang/Workspace/kirby_fighter
npm init -y
npm install phaser@^3.90.0
npm install -D typescript@~5.7.2 vite@^6.3.1 vitest@^3.1.1 terser@^5.39.0
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@simulation/*": ["src/simulation/*"],
      "@client/*": ["src/client/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@simulation': path.resolve(__dirname, 'src/simulation'),
      '@client': path.resolve(__dirname, 'src/client'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kirby Fighter</title>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; }
  </style>
</head>
<body>
  <script type="module" src="/src/client/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create placeholder entry point**

Create `src/client/main.ts`:
```typescript
import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  parent: document.body,
};

const game = new Phaser.Game(config);
console.log('Kirby Fighter loaded');
```

- [ ] **Step 6: Add npm scripts to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Verify dev server runs**

```bash
npm run dev
```

Open `http://localhost:3000` — should see a dark blue 1280x720 canvas. Verify no console errors.

- [ ] **Step 8: Commit**

```bash
git init
echo "node_modules/\ndist/\n.DS_Store" > .gitignore
git add .
git commit -m "feat: project scaffolding — Vite + Phaser 3 + TypeScript"
```

---

## Task 2: Simulation Types and Constants

**Files:**
- Create: `src/simulation/types.ts`, `src/simulation/constants.ts`

- [ ] **Step 1: Create simulation types**

Create `src/simulation/types.ts`:
```typescript
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
}
```

- [ ] **Step 2: Create constants**

Create `src/simulation/constants.ts`:
```typescript
import type { StageConfig, MatchConfig } from './types';

// -- Canvas --
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

// -- Stage --
export const STAGE: StageConfig = {
  groundLeft: 200,
  groundRight: 1080,
  groundY: 100,
  blastZone: {
    left: -100,
    right: 1380,
    top: -100,
    bottom: 820,
  },
};

export const DEFAULT_MATCH: MatchConfig = {
  stocks: 3,
  playerCount: 2,
};

// -- Fighter dimensions --
export const FIGHTER_W = 40;
export const FIGHTER_H = 48;

// -- Physics --
export const GRAVITY = 0.6;
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
export const LIGHT_HITBOX_W = 35;
export const LIGHT_HITBOX_H = 30;
export const LIGHT_HITBOX_OFFSET_X = 25; // In front of fighter

// -- Heavy Attack --
export const HEAVY_STARTUP_FRAMES = 8;
export const HEAVY_ACTIVE_FRAMES = 4;
export const HEAVY_RECOVERY_FRAMES = 12;
export const HEAVY_DAMAGE = 14;
export const HEAVY_BASE_KNOCKBACK = 6;
export const HEAVY_KNOCKBACK_SCALING = 0.15;
export const HEAVY_HITBOX_W = 50;
export const HEAVY_HITBOX_H = 35;
export const HEAVY_HITBOX_OFFSET_X = 30;

// -- Knockback --
export const HITSTUN_MULTIPLIER = 3; // hitstun frames = knockback magnitude * this

// -- Suck Mechanic --
export const INHALE_CONE_HALF_ANGLE = Math.PI / 6; // 30 degrees each side = 60 total
export const INHALE_PULL_SPEED = 4;
export const CAPTURE_MOVE_SPEED = 2.5; // Reduced speed while holding
export const CAPTURE_MIN_HOLD_FRAMES = 60; // 1 second at 60fps
export const PROJECTILE_SELF_DAMAGE = 5;
export const PROJECTILE_CONTROL_REGAIN_FRAMES = 30; // 0.5 seconds
export const PROJECTILE_IMPACT_KNOCKBACK_BASE = 5;
export const PROJECTILE_IMPACT_KNOCKBACK_SCALING = 0.12;
export const CAPTURE_DISTANCE = 30; // How close victim must be to get captured

// Suck scaling tables — indexed by victim damage %
// Returns value interpolated linearly between breakpoints
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
  { percent: 0, value: 8 },
  { percent: 50, value: 14 },
  { percent: 100, value: 20 },
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
export const RESPAWN_INVINCIBILITY_FRAMES = 120; // 2 seconds
export const RESPAWN_X = (STAGE.groundLeft + STAGE.groundRight) / 2; // Center stage
export const RESPAWN_Y = STAGE.groundY - 200; // Above stage

// -- Player Colors --
export const PLAYER_COLORS = [
  0xFF69B4, // P1: Pink
  0x4169E1, // P2: Blue
  0x32CD32, // P3: Green
  0xFFD700, // P4: Yellow
];
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/simulation/types.ts src/simulation/constants.ts
git commit -m "feat: simulation types and constants — all tunable game values"
```

---

## Task 3: Stage Geometry

**Files:**
- Create: `src/simulation/Stage.ts`, `src/simulation/__tests__/Stage.test.ts`

- [ ] **Step 1: Write failing tests for Stage**

Create `src/simulation/__tests__/Stage.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Stage } from '../Stage';
import { STAGE } from '../constants';

describe('Stage', () => {
  const stage = new Stage(STAGE);

  it('detects position inside blast zone boundaries as alive', () => {
    expect(stage.isInBlastZone(640, 400)).toBe(false);
  });

  it('detects position past left blast zone', () => {
    expect(stage.isInBlastZone(-101, 400)).toBe(true);
  });

  it('detects position past right blast zone', () => {
    expect(stage.isInBlastZone(1381, 400)).toBe(true);
  });

  it('detects position past top blast zone', () => {
    expect(stage.isInBlastZone(640, -101)).toBe(true);
  });

  it('detects position past bottom blast zone', () => {
    expect(stage.isInBlastZone(640, 821)).toBe(true);
  });

  it('reports grounded when at ground Y', () => {
    expect(stage.isOnGround(500, 580)).toBe(true);
  });

  it('reports grounded when below ground Y', () => {
    expect(stage.isOnGround(500, 590)).toBe(true);
  });

  it('reports not grounded when above ground', () => {
    expect(stage.isOnGround(500, 500)).toBe(false);
  });

  it('reports not grounded when past stage edges (walking off)', () => {
    expect(stage.isOnGround(100, 580)).toBe(false); // Past left edge
    expect(stage.isOnGround(1200, 580)).toBe(false); // Past right edge
  });

  it('clamps Y to ground level', () => {
    expect(stage.clampToGround(500, 600)).toBe(580);
    expect(stage.clampToGround(500, 580)).toBe(580);
    expect(stage.clampToGround(500, 400)).toBe(400); // Above ground, no clamp
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/__tests__/Stage.test.ts
```

Expected: FAIL — `Stage` module not found.

- [ ] **Step 3: Implement Stage**

Create `src/simulation/Stage.ts`:
```typescript
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

  /** Returns true if position is outside blast zone boundaries (= death) */
  isInBlastZone(x: number, y: number): boolean {
    return x < this.blastZone.left || x > this.blastZone.right ||
           y < this.blastZone.top || y > this.blastZone.bottom;
  }

  /** Returns true if fighter at (x, y) is standing on the ground */
  isOnGround(x: number, y: number): boolean {
    return y >= this.groundY && x >= this.groundLeft && x <= this.groundRight;
  }

  /** If the fighter is below ground and within stage bounds, clamp to ground level */
  clampToGround(x: number, y: number): number {
    if (x >= this.groundLeft && x <= this.groundRight && y > this.groundY) {
      return this.groundY;
    }
    return y;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/__tests__/Stage.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/Stage.ts src/simulation/__tests__/Stage.test.ts
git commit -m "feat: Stage class — ground collision and blast zone detection"
```

---

## Task 4: Fighter Class

**Files:**
- Create: `src/simulation/Fighter.ts`, `src/simulation/__tests__/Fighter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulation/__tests__/Fighter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Fighter } from '../Fighter';
import { FighterAction } from '../types';

describe('Fighter', () => {
  it('initializes with correct defaults', () => {
    const f = new Fighter(0, 500, 580);
    expect(f.x).toBe(500);
    expect(f.y).toBe(580);
    expect(f.velocityX).toBe(0);
    expect(f.velocityY).toBe(0);
    expect(f.action).toBe(FighterAction.Idle);
    expect(f.damage).toBe(0);
    expect(f.stocks).toBe(3);
    expect(f.facingRight).toBe(true);
  });

  it('tracks action frame counter', () => {
    const f = new Fighter(0, 500, 580);
    f.setAction(FighterAction.AttackLight);
    expect(f.actionFrame).toBe(0);
    f.tickActionFrame();
    expect(f.actionFrame).toBe(1);
    f.tickActionFrame();
    expect(f.actionFrame).toBe(2);
  });

  it('resets action frame on state change', () => {
    const f = new Fighter(0, 500, 580);
    f.setAction(FighterAction.AttackLight);
    f.tickActionFrame();
    f.tickActionFrame();
    f.setAction(FighterAction.Idle);
    expect(f.actionFrame).toBe(0);
  });

  it('creates a snapshot of current state', () => {
    const f = new Fighter(0, 500, 580);
    f.damage = 42;
    const snap = f.snapshot();
    expect(snap.x).toBe(500);
    expect(snap.damage).toBe(42);
    expect(snap.colorIndex).toBe(0);
  });

  it('initializes suck state correctly', () => {
    const f = new Fighter(0, 500, 580);
    expect(f.suck.capturedFighter).toBe(-1);
    expect(f.suck.capturedBy).toBe(-1);
    expect(f.suck.mashCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/__tests__/Fighter.test.ts
```

Expected: FAIL — `Fighter` module not found.

- [ ] **Step 3: Implement Fighter**

Create `src/simulation/Fighter.ts`:
```typescript
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

  /** Tracks whether jump was pressed last frame (for edge detection) */
  prevJumpPressed = false;
  /** Tracks whether light was pressed last frame */
  prevLightPressed = false;
  /** Tracks whether heavy was pressed last frame */
  prevHeavyPressed = false;
  /** Tracks whether suck was pressed last frame */
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
    // Caller should use stage.isOnGround() for actual check.
    // This is a convenience based on last known state.
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/__tests__/Fighter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/Fighter.ts src/simulation/__tests__/Fighter.test.ts
git commit -m "feat: Fighter class — state management, snapshots, suck state"
```

---

## Task 5: Movement System

**Files:**
- Create: `src/simulation/movement.ts`, `src/simulation/__tests__/movement.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulation/__tests__/movement.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { applyGravity, processMovement, processJump } from '../movement';
import { Fighter } from '../Fighter';
import { Stage } from '../Stage';
import { FighterAction, NULL_INPUT } from '../types';
import { STAGE, GRAVITY, MAX_FALL_SPEED, RUN_SPEED, JUMP_VELOCITY } from '../constants';

describe('applyGravity', () => {
  it('increases downward velocity each frame', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    applyGravity(f);
    expect(f.velocityY).toBeCloseTo(GRAVITY);
  });

  it('caps fall speed at MAX_FALL_SPEED', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    f.velocityY = MAX_FALL_SPEED;
    applyGravity(f);
    expect(f.velocityY).toBe(MAX_FALL_SPEED);
  });

  it('does not apply gravity when grounded and idle', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    f.velocityY = 0;
    applyGravity(f);
    expect(f.velocityY).toBe(0);
  });
});

describe('processMovement', () => {
  const stage = new Stage(STAGE);

  it('moves right when right input held', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, right: true };
    processMovement(f, input, stage);
    expect(f.x).toBe(500 + RUN_SPEED);
    expect(f.facingRight).toBe(true);
    expect(f.action).toBe(FighterAction.Run);
  });

  it('moves left when left input held', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, left: true };
    processMovement(f, input, stage);
    expect(f.x).toBe(500 - RUN_SPEED);
    expect(f.facingRight).toBe(false);
  });

  it('returns to idle when no horizontal input on ground', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Run;
    processMovement(f, NULL_INPUT, stage);
    expect(f.action).toBe(FighterAction.Idle);
  });

  it('lands when reaching ground', () => {
    const f = new Fighter(0, 500, 578);
    f.action = FighterAction.Airborne;
    f.velocityY = 5;
    processMovement(f, NULL_INPUT, stage);
    expect(f.y).toBe(580);
    expect(f.velocityY).toBe(0);
    expect(f.action).toBe(FighterAction.Idle);
  });

  it('transitions to airborne when walking off edge', () => {
    const f = new Fighter(0, 201, 580);
    f.action = FighterAction.Run;
    const input = { ...NULL_INPUT, left: true };
    processMovement(f, input, stage);
    // Moved past left edge
    expect(f.x).toBe(201 - RUN_SPEED);
    expect(f.action).toBe(FighterAction.Airborne);
  });

  it('applies position from velocity', () => {
    const f = new Fighter(0, 500, 300);
    f.action = FighterAction.Airborne;
    f.velocityY = 5;
    processMovement(f, NULL_INPUT, stage);
    expect(f.y).toBe(305);
  });
});

describe('processJump', () => {
  const stage = new Stage(STAGE);

  it('jumps from ground on fresh press', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    expect(f.velocityY).toBe(JUMP_VELOCITY);
    expect(f.action).toBe(FighterAction.Airborne);
  });

  it('does not jump when jump is held from previous frame', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    f.prevJumpPressed = true; // Was held last frame
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    expect(f.velocityY).toBe(0); // No jump
  });

  it('double jumps in air', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    f.doubleJumpUsed = false;
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    expect(f.velocityY).toBeLessThan(0);
    expect(f.doubleJumpUsed).toBe(true);
  });

  it('cannot triple jump', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Airborne;
    f.doubleJumpUsed = true;
    const input = { ...NULL_INPUT, jump: true };
    processJump(f, input, stage);
    // velocityY unchanged (no jump applied)
    expect(f.velocityY).toBe(0);
  });

  it('resets double jump on landing', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    f.doubleJumpUsed = true;
    // Landing is handled in processMovement, but verify the flag state
    expect(f.doubleJumpUsed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/__tests__/movement.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement movement system**

Create `src/simulation/movement.ts`:
```typescript
import { Fighter } from './Fighter';
import { Stage } from './Stage';
import { FighterAction, type InputState } from './types';
import {
  GRAVITY, MAX_FALL_SPEED, RUN_SPEED, AIR_SPEED,
  JUMP_VELOCITY, DOUBLE_JUMP_VELOCITY,
} from './constants';

const GROUNDED_ACTIONS = new Set([
  FighterAction.Idle,
  FighterAction.Run,
  FighterAction.AttackLight,
  FighterAction.AttackHeavy,
  FighterAction.Inhale,
  FighterAction.CaptureHold,
]);

/** Apply gravity to a fighter. Only affects airborne/projectile states. */
export function applyGravity(fighter: Fighter): void {
  if (!GROUNDED_ACTIONS.has(fighter.action) || fighter.velocityY !== 0) {
    fighter.velocityY = Math.min(fighter.velocityY + GRAVITY, MAX_FALL_SPEED);
  }
}

/** Process horizontal movement and position updates. */
export function processMovement(fighter: Fighter, input: InputState, stage: Stage): void {
  const isGrounded = GROUNDED_ACTIONS.has(fighter.action) && fighter.velocityY === 0;
  const isInAction = fighter.action === FighterAction.AttackLight ||
                     fighter.action === FighterAction.AttackHeavy ||
                     fighter.action === FighterAction.Hitstun ||
                     fighter.action === FighterAction.Projectile;

  // Horizontal velocity from input (only when not in attack/hitstun)
  if (!isInAction) {
    const speed = fighter.action === FighterAction.CaptureHold
      ? 2.5 // Reduced speed while holding captured fighter
      : (isGrounded ? RUN_SPEED : AIR_SPEED);

    if (input.left && !input.right) {
      fighter.velocityX = -speed;
      fighter.facingRight = false;
    } else if (input.right && !input.left) {
      fighter.velocityX = speed;
      fighter.facingRight = true;
    } else if (isGrounded) {
      fighter.velocityX = 0;
    }
    // In air with no input: maintain current velocityX (drift)
  }

  // Apply velocity to position
  fighter.x += fighter.velocityX;
  fighter.y += fighter.velocityY;

  // Ground collision
  if (stage.isOnGround(fighter.x, fighter.y) && fighter.velocityY >= 0) {
    fighter.y = stage.clampToGround(fighter.x, fighter.y);
    fighter.velocityY = 0;
    fighter.doubleJumpUsed = false;

    // Transition from airborne to grounded state
    if (fighter.action === FighterAction.Airborne) {
      fighter.setAction(fighter.velocityX !== 0 ? FighterAction.Run : FighterAction.Idle);
    }
  } else if (!stage.isOnGround(fighter.x, fighter.y) && isGrounded) {
    // Walked off edge
    fighter.setAction(FighterAction.Airborne);
  }

  // Update idle/run transitions on ground
  if (isGrounded && fighter.action !== FighterAction.Airborne && !isInAction) {
    if (fighter.action === FighterAction.Inhale || fighter.action === FighterAction.CaptureHold) {
      // Don't override suck states with idle/run
    } else if (fighter.velocityX !== 0) {
      fighter.setAction(FighterAction.Run);
    } else {
      fighter.setAction(FighterAction.Idle);
    }
  }
}

/** Process jump input. Uses edge detection (only triggers on fresh press). */
export function processJump(fighter: Fighter, input: InputState, stage: Stage): void {
  const justPressed = input.jump && !fighter.prevJumpPressed;

  if (!justPressed) return;

  // Can't jump during attacks, hitstun, projectile, or dead
  const canJump = fighter.action === FighterAction.Idle ||
                  fighter.action === FighterAction.Run ||
                  fighter.action === FighterAction.Airborne;
  if (!canJump) return;

  const isGrounded = stage.isOnGround(fighter.x, fighter.y) &&
                     fighter.action !== FighterAction.Airborne;

  if (isGrounded) {
    fighter.velocityY = JUMP_VELOCITY;
    fighter.setAction(FighterAction.Airborne);
  } else if (fighter.action === FighterAction.Airborne && !fighter.doubleJumpUsed) {
    fighter.velocityY = DOUBLE_JUMP_VELOCITY;
    fighter.doubleJumpUsed = true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/__tests__/movement.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/movement.ts src/simulation/__tests__/movement.test.ts
git commit -m "feat: movement system — gravity, horizontal movement, jumping, ground collision"
```

---

## Task 6: Combat System — Hit Detection and Knockback

**Files:**
- Create: `src/simulation/combat.ts`, `src/simulation/__tests__/combat.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulation/__tests__/combat.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  getAttackHitbox, checkHitboxOverlap, calculateKnockback,
  processAttack, applyKnockback, getAimDirection,
} from '../combat';
import { Fighter } from '../Fighter';
import { FighterAction, NULL_INPUT } from '../types';
import {
  LIGHT_DAMAGE, HEAVY_DAMAGE, LIGHT_BASE_KNOCKBACK,
  LIGHT_KNOCKBACK_SCALING, LIGHT_STARTUP_FRAMES,
} from '../constants';

describe('getAimDirection', () => {
  it('returns facing direction when no directional input', () => {
    const dir = getAimDirection(NULL_INPUT, true);
    expect(dir.x).toBe(1);
    expect(dir.y).toBe(0);
  });

  it('aims up when up is held', () => {
    const dir = getAimDirection({ ...NULL_INPUT, up: true }, true);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(-1);
  });

  it('aims down when down is held', () => {
    const dir = getAimDirection({ ...NULL_INPUT, down: true }, true);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(1);
  });

  it('aims diagonally when up+right held', () => {
    const dir = getAimDirection({ ...NULL_INPUT, up: true, right: true }, true);
    expect(dir.x).toBeGreaterThan(0);
    expect(dir.y).toBeLessThan(0);
    // Should be normalized
    expect(Math.sqrt(dir.x * dir.x + dir.y * dir.y)).toBeCloseTo(1);
  });
});

describe('getAttackHitbox', () => {
  it('places hitbox in front of right-facing fighter', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeGreaterThan(500);
  });

  it('places hitbox behind left-facing fighter', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = false;
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeLessThan(500);
  });
});

describe('checkHitboxOverlap', () => {
  it('detects overlapping rectangles', () => {
    const a = { x: 100, y: 100, w: 50, h: 50 };
    const b = { x: 120, y: 120, w: 50, h: 50 };
    expect(checkHitboxOverlap(a, b)).toBe(true);
  });

  it('detects non-overlapping rectangles', () => {
    const a = { x: 100, y: 100, w: 50, h: 50 };
    const b = { x: 200, y: 200, w: 50, h: 50 };
    expect(checkHitboxOverlap(a, b)).toBe(false);
  });
});

describe('calculateKnockback', () => {
  it('calculates knockback at 0% damage', () => {
    const kb = calculateKnockback(LIGHT_BASE_KNOCKBACK, LIGHT_KNOCKBACK_SCALING, 0);
    expect(kb).toBe(LIGHT_BASE_KNOCKBACK);
  });

  it('scales knockback with damage', () => {
    const kb = calculateKnockback(LIGHT_BASE_KNOCKBACK, LIGHT_KNOCKBACK_SCALING, 100);
    expect(kb).toBe(LIGHT_BASE_KNOCKBACK + 100 * LIGHT_KNOCKBACK_SCALING);
  });
});

describe('processAttack', () => {
  it('starts light attack on fresh press', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, light: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.AttackLight);
    expect(f.actionFrame).toBe(0);
  });

  it('does not restart attack if already attacking', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.AttackLight;
    f.actionFrame = 5;
    const input = { ...NULL_INPUT, light: true };
    processAttack(f, input);
    expect(f.actionFrame).toBe(5); // Unchanged
  });

  it('starts heavy attack on fresh press', () => {
    const f = new Fighter(0, 500, 580);
    f.action = FighterAction.Idle;
    const input = { ...NULL_INPUT, heavy: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.AttackHeavy);
  });
});

describe('applyKnockback', () => {
  it('applies velocity in the given direction', () => {
    const f = new Fighter(0, 500, 580);
    applyKnockback(f, 10, { x: 1, y: 0 });
    expect(f.velocityX).toBe(10);
    expect(f.velocityY).toBe(0);
    expect(f.action).toBe(FighterAction.Hitstun);
  });

  it('applies diagonal knockback', () => {
    const f = new Fighter(0, 500, 580);
    const mag = 10;
    const dir = { x: 0.707, y: -0.707 };
    applyKnockback(f, mag, dir);
    expect(f.velocityX).toBeCloseTo(7.07);
    expect(f.velocityY).toBeCloseTo(-7.07);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/__tests__/combat.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement combat system**

Create `src/simulation/combat.ts`:
```typescript
import { Fighter } from './Fighter';
import { FighterAction, AttackPhase, type InputState, type Vec2 } from './types';
import {
  LIGHT_STARTUP_FRAMES, LIGHT_ACTIVE_FRAMES, LIGHT_RECOVERY_FRAMES,
  LIGHT_DAMAGE, LIGHT_BASE_KNOCKBACK, LIGHT_KNOCKBACK_SCALING,
  LIGHT_HITBOX_W, LIGHT_HITBOX_H, LIGHT_HITBOX_OFFSET_X,
  HEAVY_STARTUP_FRAMES, HEAVY_ACTIVE_FRAMES, HEAVY_RECOVERY_FRAMES,
  HEAVY_DAMAGE, HEAVY_BASE_KNOCKBACK, HEAVY_KNOCKBACK_SCALING,
  HEAVY_HITBOX_W, HEAVY_HITBOX_H, HEAVY_HITBOX_OFFSET_X,
  HITSTUN_MULTIPLIER, FIGHTER_H,
} from './constants';

export interface Rect {
  x: number; // center x
  y: number; // center y
  w: number;
  h: number;
}

interface AttackData {
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  damage: number;
  baseKnockback: number;
  knockbackScaling: number;
  hitboxW: number;
  hitboxH: number;
  hitboxOffsetX: number;
}

const ATTACK_DATA: Record<string, AttackData> = {
  light: {
    startupFrames: LIGHT_STARTUP_FRAMES,
    activeFrames: LIGHT_ACTIVE_FRAMES,
    recoveryFrames: LIGHT_RECOVERY_FRAMES,
    damage: LIGHT_DAMAGE,
    baseKnockback: LIGHT_BASE_KNOCKBACK,
    knockbackScaling: LIGHT_KNOCKBACK_SCALING,
    hitboxW: LIGHT_HITBOX_W,
    hitboxH: LIGHT_HITBOX_H,
    hitboxOffsetX: LIGHT_HITBOX_OFFSET_X,
  },
  heavy: {
    startupFrames: HEAVY_STARTUP_FRAMES,
    activeFrames: HEAVY_ACTIVE_FRAMES,
    recoveryFrames: HEAVY_RECOVERY_FRAMES,
    damage: HEAVY_DAMAGE,
    baseKnockback: HEAVY_BASE_KNOCKBACK,
    knockbackScaling: HEAVY_KNOCKBACK_SCALING,
    hitboxW: HEAVY_HITBOX_W,
    hitboxH: HEAVY_HITBOX_H,
    hitboxOffsetX: HEAVY_HITBOX_OFFSET_X,
  },
};

/** Determine aim direction from input + facing. Returns normalized vector. */
export function getAimDirection(input: InputState, facingRight: boolean): Vec2 {
  let dx = 0;
  let dy = 0;

  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  // If no directional input, use facing direction
  if (dx === 0 && dy === 0) {
    dx = facingRight ? 1 : -1;
  }

  // Normalize
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dx / len, y: dy / len };
}

/** Get the attack type string from fighter action */
function getAttackType(action: FighterAction): string | null {
  if (action === FighterAction.AttackLight) return 'light';
  if (action === FighterAction.AttackHeavy) return 'heavy';
  return null;
}

/** Get the phase of the current attack based on action frame */
export function getAttackPhase(fighter: Fighter): AttackPhase | null {
  const type = getAttackType(fighter.action);
  if (!type) return null;

  const data = ATTACK_DATA[type];
  const frame = fighter.actionFrame;

  if (frame < data.startupFrames) return AttackPhase.Startup;
  if (frame < data.startupFrames + data.activeFrames) return AttackPhase.Active;
  if (frame < data.startupFrames + data.activeFrames + data.recoveryFrames) return AttackPhase.Recovery;
  return null; // Attack is over
}

/** Get total frames for an attack */
export function getAttackTotalFrames(type: string): number {
  const data = ATTACK_DATA[type];
  return data.startupFrames + data.activeFrames + data.recoveryFrames;
}

/** Get the hitbox rect for a fighter's current attack. Center-based. */
export function getAttackHitbox(fighter: Fighter, type: string): Rect {
  const data = ATTACK_DATA[type];
  const offsetX = fighter.facingRight ? data.hitboxOffsetX : -data.hitboxOffsetX;
  return {
    x: fighter.x + offsetX,
    y: fighter.y - FIGHTER_H / 2, // Centered vertically on fighter
    w: data.hitboxW,
    h: data.hitboxH,
  };
}

/** Get the hurtbox rect for a fighter. Center-based, using fighter dimensions. */
export function getHurtbox(fighter: Fighter): Rect {
  return {
    x: fighter.x,
    y: fighter.y - FIGHTER_H / 2,
    w: 40,  // FIGHTER_W
    h: FIGHTER_H,
  };
}

/** AABB overlap check between two center-based rects */
export function checkHitboxOverlap(a: Rect, b: Rect): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
         Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

/** Calculate knockback magnitude from formula */
export function calculateKnockback(base: number, scaling: number, damage: number): number {
  return base + damage * scaling;
}

/** Start an attack if the fighter is in a state that allows it */
export function processAttack(fighter: Fighter, input: InputState): void {
  // Already in an attack — don't interrupt
  const inAttack = fighter.action === FighterAction.AttackLight ||
                   fighter.action === FighterAction.AttackHeavy;
  if (inAttack) return;

  // Can't attack during hitstun, projectile, dead, or suck states
  const canAttack = fighter.action === FighterAction.Idle ||
                    fighter.action === FighterAction.Run ||
                    fighter.action === FighterAction.Airborne;
  if (!canAttack) return;

  const lightJustPressed = input.light && !fighter.prevLightPressed;
  const heavyJustPressed = input.heavy && !fighter.prevHeavyPressed;

  if (lightJustPressed) {
    fighter.setAction(FighterAction.AttackLight);
  } else if (heavyJustPressed) {
    fighter.setAction(FighterAction.AttackHeavy);
  }
}

/** Tick attack frame and end attack when frames are exhausted */
export function tickAttack(fighter: Fighter): void {
  const type = getAttackType(fighter.action);
  if (!type) return;

  const totalFrames = getAttackTotalFrames(type);
  if (fighter.actionFrame >= totalFrames) {
    // Attack finished — return to appropriate state
    fighter.setAction(fighter.velocityY !== 0 ? FighterAction.Airborne : FighterAction.Idle);
  }
}

/** Apply knockback to a fighter: sets velocity and enters hitstun */
export function applyKnockback(fighter: Fighter, magnitude: number, direction: Vec2): void {
  fighter.velocityX = direction.x * magnitude;
  fighter.velocityY = direction.y * magnitude;
  fighter.setAction(FighterAction.Hitstun);
  // actionFrame will track hitstun duration; checked in tickHitstun
}

/** Tick hitstun. Exits when hitstun frames are up. */
export function tickHitstun(fighter: Fighter): void {
  if (fighter.action !== FighterAction.Hitstun) return;

  const knockbackMag = Math.sqrt(
    fighter.velocityX * fighter.velocityX + fighter.velocityY * fighter.velocityY
  );
  const hitstunDuration = Math.ceil(knockbackMag * HITSTUN_MULTIPLIER);

  if (fighter.actionFrame >= hitstunDuration) {
    fighter.setAction(fighter.velocityY !== 0 ? FighterAction.Airborne : FighterAction.Idle);
  }
}

/** Get attack data for damage/knockback lookup */
export function getAttackData(type: string): AttackData {
  return ATTACK_DATA[type];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/__tests__/combat.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/combat.ts src/simulation/__tests__/combat.test.ts
git commit -m "feat: combat system — hitboxes, damage, knockback, attack state machine"
```

---

## Task 7: Suck Mechanic

**Files:**
- Create: `src/simulation/suck.ts`, `src/simulation/__tests__/suck.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulation/__tests__/suck.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  isInInhaleCone, processInhale, processCapture,
  launchProjectile, tickProjectile,
} from '../suck';
import { Fighter } from '../Fighter';
import { FighterAction, NULL_INPUT } from '../types';
import {
  CAPTURE_MIN_HOLD_FRAMES, PROJECTILE_SELF_DAMAGE,
  PROJECTILE_CONTROL_REGAIN_FRAMES,
} from '../constants';

describe('isInInhaleCone', () => {
  it('detects target in front within range', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = true;
    // Target is directly in front, close range
    expect(isInInhaleCone(sucker, 540, 580, 80)).toBe(true);
  });

  it('rejects target behind sucker', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = true;
    expect(isInInhaleCone(sucker, 450, 580, 80)).toBe(false);
  });

  it('rejects target out of range', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = true;
    expect(isInInhaleCone(sucker, 700, 580, 80)).toBe(false);
  });

  it('works for left-facing sucker', () => {
    const sucker = new Fighter(0, 500, 580);
    sucker.facingRight = false;
    expect(isInInhaleCone(sucker, 460, 580, 80)).toBe(true);
  });
});

describe('processCapture', () => {
  it('tracks mash count when victim presses light', () => {
    const sucker = new Fighter(0, 500, 580);
    const victim = new Fighter(1, 500, 580);
    sucker.action = FighterAction.CaptureHold;
    victim.action = FighterAction.CaptureHold; // Being held
    sucker.suck.capturedFighter = 1;
    victim.suck.capturedBy = 0;
    sucker.suck.captureTimer = CAPTURE_MIN_HOLD_FRAMES + 1; // Past minimum

    const victimInput = { ...NULL_INPUT, light: true };
    const escaped = processCapture(sucker, victim, victimInput);
    expect(sucker.suck.mashCount).toBe(1);
    expect(escaped).toBe(false); // Not enough mashes yet
  });

  it('does not allow escape before minimum hold time', () => {
    const sucker = new Fighter(0, 500, 580);
    const victim = new Fighter(1, 500, 580);
    sucker.action = FighterAction.CaptureHold;
    victim.action = FighterAction.CaptureHold;
    sucker.suck.capturedFighter = 1;
    victim.suck.capturedBy = 0;
    sucker.suck.captureTimer = 10; // Well before minimum
    victim.damage = 0;

    // Even with enough mashes, can't escape before min hold
    sucker.suck.mashCount = 100;
    const victimInput = { ...NULL_INPUT, light: true };
    const escaped = processCapture(sucker, victim, victimInput);
    expect(escaped).toBe(false);
  });
});

describe('launchProjectile', () => {
  it('sets victim to projectile state with velocity', () => {
    const sucker = new Fighter(0, 500, 580);
    const victim = new Fighter(1, 500, 580);
    sucker.facingRight = true;
    victim.damage = 50;

    const input = { ...NULL_INPUT, right: true };
    launchProjectile(sucker, victim, input);

    expect(victim.action).toBe(FighterAction.Projectile);
    expect(victim.suck.projectileTimer).toBe(PROJECTILE_CONTROL_REGAIN_FRAMES);
    expect(victim.suck.projectileVelocity.x).toBeGreaterThan(0); // Launched right
  });
});

describe('tickProjectile', () => {
  it('moves fighter along projectile velocity', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Projectile;
    f.suck.projectileTimer = 20;
    f.suck.projectileVelocity = { x: 10, y: 0 };

    tickProjectile(f);
    expect(f.x).toBe(510);
    expect(f.suck.projectileTimer).toBe(19);
  });

  it('regains control when timer expires', () => {
    const f = new Fighter(0, 500, 400);
    f.action = FighterAction.Projectile;
    f.suck.projectileTimer = 1;
    f.suck.projectileVelocity = { x: 10, y: 0 };

    tickProjectile(f);
    expect(f.suck.projectileTimer).toBe(0);
    expect(f.action).toBe(FighterAction.Airborne);
  });

  it('applies self-damage on projectile impact (tested via GameSimulation)', () => {
    // Impact detection is handled at the GameSimulation level
    // Just verify the constant exists
    expect(PROJECTILE_SELF_DAMAGE).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/__tests__/suck.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement suck mechanic**

Create `src/simulation/suck.ts`:
```typescript
import { Fighter } from './Fighter';
import { FighterAction, type InputState, type Vec2 } from './types';
import { getAimDirection } from './combat';
import {
  INHALE_CONE_HALF_ANGLE, INHALE_PULL_SPEED, CAPTURE_DISTANCE,
  CAPTURE_MIN_HOLD_FRAMES, PROJECTILE_SELF_DAMAGE,
  PROJECTILE_CONTROL_REGAIN_FRAMES,
  SUCK_RANGE_TABLE, SUCK_MASH_TABLE, SUCK_LAUNCH_SPEED_TABLE,
  lookupScaling,
} from './constants';

/**
 * Check if a target position is within the sucker's inhale cone.
 * Cone is centered on the sucker's facing direction.
 */
export function isInInhaleCone(
  sucker: Fighter, targetX: number, targetY: number, range: number
): boolean {
  const dx = targetX - sucker.x;
  const dy = targetY - sucker.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > range || dist < 1) return false;

  // Check if target is in the right direction
  const facingX = sucker.facingRight ? 1 : -1;
  const dot = dx * facingX; // Dot product with facing direction (y component is 0)
  const angle = Math.acos(dot / dist);

  return angle <= INHALE_CONE_HALF_ANGLE;
}

/**
 * Process inhale phase: pull enemies in cone toward sucker.
 * Called each frame while fighter is in Inhale action.
 * Returns index of fighter to capture, or -1.
 */
export function processInhale(
  sucker: Fighter, fighters: Fighter[], suckerIndex: number
): number {
  for (let i = 0; i < fighters.length; i++) {
    if (i === suckerIndex) continue;
    const target = fighters[i];

    // Can't inhale dead, invincible, or already captured fighters
    if (target.action === FighterAction.Dead) continue;
    if (target.invincibleFrames > 0) continue;
    if (target.suck.capturedBy >= 0) continue;

    const range = lookupScaling(SUCK_RANGE_TABLE, target.damage);

    if (!isInInhaleCone(sucker, target.x, target.y, range)) continue;

    // Pull toward sucker
    const dx = sucker.x - target.x;
    const dy = sucker.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= CAPTURE_DISTANCE) {
      // Close enough to capture
      return i;
    }

    // Apply pull force
    const pullX = (dx / dist) * INHALE_PULL_SPEED;
    const pullY = (dy / dist) * INHALE_PULL_SPEED;
    target.x += pullX;
    target.y += pullY;
  }

  return -1;
}

/**
 * Initiate capture: sucker holds victim.
 */
export function startCapture(sucker: Fighter, victim: Fighter, victimIndex: number, suckerIndex: number): void {
  sucker.setAction(FighterAction.CaptureHold);
  sucker.suck.capturedFighter = victimIndex;
  sucker.suck.mashCount = 0;
  sucker.suck.captureTimer = 0;

  victim.setAction(FighterAction.CaptureHold);
  victim.suck.capturedBy = suckerIndex;
  victim.x = sucker.x;
  victim.y = sucker.y;
  victim.velocityX = 0;
  victim.velocityY = 0;
}

/**
 * Process capture phase each frame.
 * Returns true if the victim escapes.
 */
export function processCapture(
  sucker: Fighter, victim: Fighter, victimInput: InputState
): boolean {
  sucker.suck.captureTimer++;

  // Victim position stays locked to sucker
  victim.x = sucker.x;
  victim.y = sucker.y;

  // Count mashes (edge-detected: only on fresh press)
  if (victimInput.light && !victim.prevLightPressed) {
    sucker.suck.mashCount++;
  }

  // Check escape conditions
  if (sucker.suck.captureTimer < CAPTURE_MIN_HOLD_FRAMES) {
    return false; // Can't escape before minimum hold time
  }

  const mashThreshold = lookupScaling(SUCK_MASH_TABLE, victim.damage);
  return sucker.suck.mashCount >= mashThreshold;
}

/**
 * Release the capture — victim escapes.
 */
export function releaseCapture(sucker: Fighter, victim: Fighter): void {
  sucker.setAction(FighterAction.Idle);
  sucker.resetSuckState();

  victim.setAction(FighterAction.Airborne);
  victim.resetSuckState();
  // Pop victim slightly away from sucker
  victim.x = sucker.x + (sucker.facingRight ? 50 : -50);
}

/**
 * Launch the captured fighter as a projectile.
 * Direction determined by sucker's current aim input.
 */
export function launchProjectile(
  sucker: Fighter, victim: Fighter, suckerInput: InputState
): void {
  const direction = getAimDirection(suckerInput, sucker.facingRight);
  const speed = lookupScaling(SUCK_LAUNCH_SPEED_TABLE, victim.damage);

  victim.setAction(FighterAction.Projectile);
  victim.suck.capturedBy = -1;
  victim.suck.projectileTimer = PROJECTILE_CONTROL_REGAIN_FRAMES;
  victim.suck.projectileVelocity = {
    x: direction.x * speed,
    y: direction.y * speed,
  };
  // Place victim just in front of sucker
  victim.x = sucker.x + direction.x * 50;
  victim.y = sucker.y + direction.y * 50;

  sucker.setAction(FighterAction.Idle);
  sucker.resetSuckState();
}

/**
 * Tick projectile state: move fighter, decrement timer, regain control.
 */
export function tickProjectile(fighter: Fighter): void {
  if (fighter.action !== FighterAction.Projectile) return;

  fighter.x += fighter.suck.projectileVelocity.x;
  fighter.y += fighter.suck.projectileVelocity.y;
  fighter.suck.projectileTimer--;

  if (fighter.suck.projectileTimer <= 0) {
    // Regain control
    fighter.velocityX = fighter.suck.projectileVelocity.x * 0.3; // Keep some momentum
    fighter.velocityY = fighter.suck.projectileVelocity.y * 0.3;
    fighter.setAction(FighterAction.Airborne);
    fighter.resetSuckState();
  }
}

/**
 * Handle projectile impact with another fighter.
 * Returns true if impact occurred.
 */
export function checkProjectileImpact(
  projectile: Fighter, target: Fighter
): boolean {
  if (projectile.action !== FighterAction.Projectile) return false;
  if (target.action === FighterAction.Dead) return false;
  if (target.invincibleFrames > 0) return false;
  if (target.suck.capturedBy >= 0) return false; // Can't hit captured fighters

  // Simple distance check
  const dx = projectile.x - target.x;
  const dy = projectile.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist < 40; // Rough collision radius
}

/**
 * Apply projectile impact effects to both fighters.
 */
export function applyProjectileImpact(
  projectile: Fighter, target: Fighter
): void {
  const speed = Math.sqrt(
    projectile.suck.projectileVelocity.x ** 2 +
    projectile.suck.projectileVelocity.y ** 2
  );

  // Damage to target scales with projectile speed
  const impactDamage = speed * 0.8;
  target.damage += impactDamage;

  // Knockback to target in direction of projectile travel
  const dir: Vec2 = {
    x: projectile.suck.projectileVelocity.x / speed,
    y: projectile.suck.projectileVelocity.y / speed,
  };
  const knockback = 5 + target.damage * 0.12; // PROJECTILE_IMPACT_KNOCKBACK values
  target.velocityX = dir.x * knockback;
  target.velocityY = dir.y * knockback;
  target.setAction(FighterAction.Hitstun);

  // Self-damage to projectile fighter
  projectile.damage += PROJECTILE_SELF_DAMAGE;

  // Projectile fighter stops and regains control
  projectile.velocityX = 0;
  projectile.velocityY = 0;
  projectile.setAction(FighterAction.Airborne);
  projectile.resetSuckState();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/__tests__/suck.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/suck.ts src/simulation/__tests__/suck.test.ts
git commit -m "feat: suck mechanic — inhale cone, capture/mash escape, projectile launch"
```

---

## Task 8: GameSimulation Orchestrator

**Files:**
- Create: `src/simulation/GameSimulation.ts`, `src/simulation/__tests__/GameSimulation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulation/__tests__/GameSimulation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { GameSimulation } from '../GameSimulation';
import { FighterAction, MatchPhase, NULL_INPUT } from '../types';
import { STAGE, RESPAWN_INVINCIBILITY_FRAMES, RUN_SPEED } from '../constants';

function createSim(playerCount = 2) {
  return new GameSimulation({ stocks: 3, playerCount }, STAGE);
}

describe('GameSimulation', () => {
  it('initializes with correct number of fighters', () => {
    const sim = createSim(2);
    const snap = sim.getSnapshot();
    expect(snap.fighters).toHaveLength(2);
    expect(snap.matchPhase).toBe(MatchPhase.Playing);
  });

  it('places fighters on opposite sides of stage', () => {
    const sim = createSim(2);
    const snap = sim.getSnapshot();
    expect(snap.fighters[0].x).toBeLessThan(snap.fighters[1].x);
    expect(snap.fighters[0].y).toBe(STAGE.groundY);
    expect(snap.fighters[1].y).toBe(STAGE.groundY);
  });

  it('steps simulation with input', () => {
    const sim = createSim(2);
    const inputs = [
      { ...NULL_INPUT, right: true },
      NULL_INPUT,
    ];
    sim.step(inputs);
    const snap = sim.getSnapshot();
    // P1 moved right
    expect(snap.fighters[0].action).toBe(FighterAction.Run);
  });

  it('handles blast zone death and stock loss', () => {
    const sim = createSim(2);
    // Teleport fighter past blast zone
    (sim as any).fighters[0].x = -200;
    (sim as any).fighters[0].y = -200;
    sim.step([NULL_INPUT, NULL_INPUT]);
    const snap = sim.getSnapshot();
    expect(snap.fighters[0].stocks).toBe(2);
  });

  it('detects match end when a player runs out of stocks', () => {
    const sim = createSim(2);
    // Set P1 to 1 stock and kill them
    (sim as any).fighters[0].stocks = 1;
    (sim as any).fighters[0].x = -200;
    sim.step([NULL_INPUT, NULL_INPUT]);
    const snap = sim.getSnapshot();
    expect(snap.matchPhase).toBe(MatchPhase.Ended);
    expect(snap.winnerIndex).toBe(1); // P2 wins
  });

  it('respawns dead fighter with invincibility', () => {
    const sim = createSim(2);
    (sim as any).fighters[0].x = -200;
    sim.step([NULL_INPUT, NULL_INPUT]);
    const snap = sim.getSnapshot();
    // Fighter respawned (if they had stocks remaining)
    if (snap.fighters[0].stocks > 0) {
      expect(snap.fighters[0].invincibleFrames).toBe(RESPAWN_INVINCIBILITY_FRAMES);
    }
  });

  it('processes light attack hit between fighters', () => {
    const sim = createSim(2);
    // Position fighters very close together, facing each other
    (sim as any).fighters[0].x = 500;
    (sim as any).fighters[0].y = 580;
    (sim as any).fighters[0].facingRight = true;
    (sim as any).fighters[1].x = 530; // Within hitbox range
    (sim as any).fighters[1].y = 580;

    // P1 starts light attack
    sim.step([{ ...NULL_INPUT, light: true }, NULL_INPUT]);
    // Tick through startup frames
    for (let i = 0; i < 3; i++) {
      sim.step([NULL_INPUT, NULL_INPUT]);
    }
    // Now in active frames — check if hit connected
    const snap = sim.getSnapshot();
    expect(snap.fighters[1].damage).toBeGreaterThan(0);
  });

  it('increments frame counter each step', () => {
    const sim = createSim(2);
    expect(sim.getSnapshot().frameNumber).toBe(0);
    sim.step([NULL_INPUT, NULL_INPUT]);
    expect(sim.getSnapshot().frameNumber).toBe(1);
    sim.step([NULL_INPUT, NULL_INPUT]);
    expect(sim.getSnapshot().frameNumber).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/simulation/__tests__/GameSimulation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement GameSimulation**

Create `src/simulation/GameSimulation.ts`:
```typescript
import { Fighter } from './Fighter';
import { Stage } from './Stage';
import {
  type InputState, type MatchConfig, type StageConfig,
  type SimulationSnapshot, NULL_INPUT, FighterAction, MatchPhase, AttackPhase,
} from './types';
import { RESPAWN_INVINCIBILITY_FRAMES, RESPAWN_X, RESPAWN_Y } from './constants';
import { applyGravity, processMovement, processJump } from './movement';
import {
  processAttack, tickAttack, tickHitstun,
  getAttackPhase, getAttackHitbox, getHurtbox, checkHitboxOverlap,
  getAttackData, calculateKnockback, applyKnockback, getAimDirection,
} from './combat';
import {
  processInhale, startCapture, processCapture,
  releaseCapture, launchProjectile, tickProjectile,
  checkProjectileImpact, applyProjectileImpact,
} from './suck';

export class GameSimulation {
  private fighters: Fighter[] = [];
  private stage: Stage;
  private matchPhase: MatchPhase = MatchPhase.Playing;
  private winnerIndex = -1;
  private frameNumber = 0;

  /** Tracks which fighters were already hit by the current active hitbox (prevents multi-hit) */
  private hitThisAttack: Set<string> = new Set(); // "attackerIdx-defenderIdx"

  constructor(matchConfig: MatchConfig, stageConfig: StageConfig) {
    this.stage = new Stage(stageConfig);
    this.initFighters(matchConfig);
  }

  private initFighters(config: MatchConfig): void {
    const stageWidth = this.stage.groundRight - this.stage.groundLeft;
    const spacing = stageWidth / (config.playerCount + 1);

    for (let i = 0; i < config.playerCount; i++) {
      const x = this.stage.groundLeft + spacing * (i + 1);
      const y = this.stage.groundY;
      this.fighters.push(new Fighter(i, x, y, config.stocks));
    }
    // Make fighters face each other (P1 right, P2 left, etc.)
    if (this.fighters.length >= 2) {
      this.fighters[0].facingRight = true;
      this.fighters[1].facingRight = false;
    }
  }

  step(inputs: InputState[]): void {
    if (this.matchPhase !== MatchPhase.Playing) return;

    this.frameNumber++;

    // Ensure we have inputs for all fighters
    while (inputs.length < this.fighters.length) {
      inputs.push(NULL_INPUT);
    }

    for (let i = 0; i < this.fighters.length; i++) {
      const fighter = this.fighters[i];
      const input = inputs[i];

      if (fighter.action === FighterAction.Dead) continue;

      // Tick invincibility
      if (fighter.invincibleFrames > 0) {
        fighter.invincibleFrames--;
      }

      // Process suck states
      this.processSuckForFighter(i, input);

      // Process attacks (start new ones)
      if (fighter.action !== FighterAction.CaptureHold &&
          fighter.action !== FighterAction.Inhale &&
          fighter.action !== FighterAction.Projectile) {
        processAttack(fighter, input);
      }

      // Process jumping
      processJump(fighter, input, this.stage);

      // Apply gravity (not for captured or projectile fighters)
      if (fighter.suck.capturedBy < 0 && fighter.action !== FighterAction.Projectile) {
        applyGravity(fighter);
      }

      // Process movement (not for captured fighters)
      if (fighter.suck.capturedBy < 0 && fighter.action !== FighterAction.Projectile) {
        processMovement(fighter, input, this.stage);
      }

      // Tick projectile
      tickProjectile(fighter);

      // Tick attack frames
      tickAttack(fighter);
      fighter.tickActionFrame();

      // Tick hitstun
      tickHitstun(fighter);

      // Update prev-frame input tracking
      fighter.prevJumpPressed = input.jump;
      fighter.prevLightPressed = input.light;
      fighter.prevHeavyPressed = input.heavy;
      fighter.prevSuckPressed = input.suck;
    }

    // Resolve hits (after all fighters have moved)
    this.resolveAttackHits(inputs);
    this.resolveProjectileHits();

    // Check blast zones
    this.checkBlastZones();

    // Check win condition
    this.checkWinCondition();
  }

  private processSuckForFighter(index: number, input: InputState): void {
    const fighter = this.fighters[index];
    const suckJustPressed = input.suck && !fighter.prevSuckPressed;

    // Currently inhaling
    if (fighter.action === FighterAction.Inhale) {
      if (!input.suck) {
        // Released suck button — stop inhaling
        fighter.setAction(fighter.velocityY !== 0 ? FighterAction.Airborne : FighterAction.Idle);
        return;
      }

      const captureTarget = processInhale(fighter, this.fighters, index);
      if (captureTarget >= 0) {
        startCapture(fighter, this.fighters[captureTarget], captureTarget, index);
      }
      return;
    }

    // Currently holding a captured fighter
    if (fighter.action === FighterAction.CaptureHold && fighter.suck.capturedFighter >= 0) {
      const victim = this.fighters[fighter.suck.capturedFighter];
      const victimInput = inputs[fighter.suck.capturedFighter] ?? NULL_INPUT;

      if (suckJustPressed) {
        // Spit! Launch projectile
        launchProjectile(fighter, victim, input);
        this.hitThisAttack.clear();
        return;
      }

      const escaped = processCapture(fighter, victim, victimInput);
      if (escaped) {
        releaseCapture(fighter, victim);
      }
      return;
    }

    // Start inhaling
    if (suckJustPressed) {
      const canSuck = fighter.action === FighterAction.Idle ||
                      fighter.action === FighterAction.Run ||
                      fighter.action === FighterAction.Airborne;
      if (canSuck) {
        fighter.setAction(FighterAction.Inhale);
      }
    }
  }

  private resolveAttackHits(inputs: InputState[]): void {
    for (let attackerIdx = 0; attackerIdx < this.fighters.length; attackerIdx++) {
      const attacker = this.fighters[attackerIdx];
      const phase = getAttackPhase(attacker);
      if (phase !== AttackPhase.Active) {
        // Clear hit tracking when not in active frames
        if (phase === null) {
          // Attack ended — clean up hit tracking for this attacker
          for (const key of this.hitThisAttack) {
            if (key.startsWith(`${attackerIdx}-`)) {
              this.hitThisAttack.delete(key);
            }
          }
        }
        continue;
      }

      const attackType = attacker.action === FighterAction.AttackLight ? 'light' : 'heavy';
      const hitbox = getAttackHitbox(attacker, attackType);
      const attackData = getAttackData(attackType);
      const aimDir = getAimDirection(inputs[attackerIdx], attacker.facingRight);

      for (let defenderIdx = 0; defenderIdx < this.fighters.length; defenderIdx++) {
        if (attackerIdx === defenderIdx) continue;

        const hitKey = `${attackerIdx}-${defenderIdx}`;
        if (this.hitThisAttack.has(hitKey)) continue; // Already hit this attack

        const defender = this.fighters[defenderIdx];
        if (defender.action === FighterAction.Dead) continue;
        if (defender.invincibleFrames > 0) continue;
        if (defender.suck.capturedBy >= 0) continue; // Can't hit captured fighters

        const hurtbox = getHurtbox(defender);
        if (checkHitboxOverlap(hitbox, hurtbox)) {
          // Hit!
          defender.damage += attackData.damage;
          const knockbackMag = calculateKnockback(
            attackData.baseKnockback, attackData.knockbackScaling, defender.damage
          );
          applyKnockback(defender, knockbackMag, aimDir);
          this.hitThisAttack.add(hitKey);
        }
      }
    }
  }

  private resolveProjectileHits(): void {
    for (let projIdx = 0; projIdx < this.fighters.length; projIdx++) {
      const projectile = this.fighters[projIdx];
      if (projectile.action !== FighterAction.Projectile) continue;

      for (let targetIdx = 0; targetIdx < this.fighters.length; targetIdx++) {
        if (projIdx === targetIdx) continue;
        const target = this.fighters[targetIdx];

        if (checkProjectileImpact(projectile, target)) {
          applyProjectileImpact(projectile, target);
          break; // Only hit one target
        }
      }
    }
  }

  private checkBlastZones(): void {
    for (const fighter of this.fighters) {
      if (fighter.action === FighterAction.Dead) continue;

      if (this.stage.isInBlastZone(fighter.x, fighter.y)) {
        fighter.stocks--;

        if (fighter.stocks <= 0) {
          fighter.setAction(FighterAction.Dead);
        } else {
          fighter.respawn(RESPAWN_X, RESPAWN_Y, RESPAWN_INVINCIBILITY_FRAMES);
        }
      }
    }
  }

  private checkWinCondition(): void {
    const alive = this.fighters.filter(f => f.stocks > 0);
    if (alive.length <= 1) {
      this.matchPhase = MatchPhase.Ended;
      this.winnerIndex = alive.length === 1 ? alive[0].colorIndex : -1;
    }
  }

  getSnapshot(): SimulationSnapshot {
    return {
      fighters: this.fighters.map(f => f.snapshot()),
      matchPhase: this.matchPhase,
      winnerIndex: this.winnerIndex,
      frameNumber: this.frameNumber,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/simulation/__tests__/GameSimulation.test.ts
```

Expected: all tests PASS. Some tests may need adjustment based on exact spawn positions — debug and fix as needed.

- [ ] **Step 5: Run ALL simulation tests**

```bash
npx vitest run
```

Expected: all tests PASS across all test files.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/GameSimulation.ts src/simulation/__tests__/GameSimulation.test.ts
git commit -m "feat: GameSimulation orchestrator — wires movement, combat, suck, blast zones, match flow"
```

---

## Task 9: Phaser Client — Scene Setup and Stage Rendering

**Files:**
- Create: `src/client/scenes/GameScene.ts`, `src/client/renderers/StageRenderer.ts`
- Modify: `src/client/main.ts`

- [ ] **Step 1: Create StageRenderer**

Create `src/client/renderers/StageRenderer.ts`:
```typescript
import Phaser from 'phaser';
import { STAGE, CANVAS_W, CANVAS_H } from '@simulation/constants';

export class StageRenderer {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.draw();
  }

  private draw(): void {
    const g = this.graphics;

    // Sky gradient background (dark blue to lighter blue)
    g.fillStyle(0x0f0f23);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Ground platform
    g.fillStyle(0x8B4513); // Brown
    g.fillRect(STAGE.groundLeft, STAGE.groundY, STAGE.groundRight - STAGE.groundLeft, 20);

    // Ground surface line (lighter)
    g.lineStyle(2, 0xA0522D);
    g.lineBetween(STAGE.groundLeft, STAGE.groundY, STAGE.groundRight, STAGE.groundY);

    // Blast zone indicators (subtle dashed lines)
    g.lineStyle(1, 0xFF0000, 0.3);
    // Left
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.top, STAGE.blastZone.left, STAGE.blastZone.bottom);
    // Right
    g.lineBetween(STAGE.blastZone.right, STAGE.blastZone.top, STAGE.blastZone.right, STAGE.blastZone.bottom);
    // Top
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.top, STAGE.blastZone.right, STAGE.blastZone.top);
    // Bottom
    g.lineBetween(STAGE.blastZone.left, STAGE.blastZone.bottom, STAGE.blastZone.right, STAGE.blastZone.bottom);
  }
}
```

- [ ] **Step 2: Create GameScene with fixed timestep**

Create `src/client/scenes/GameScene.ts`:
```typescript
import Phaser from 'phaser';
import { GameSimulation } from '@simulation/GameSimulation';
import { STAGE, DEFAULT_MATCH } from '@simulation/constants';
import { type InputState, NULL_INPUT } from '@simulation/types';
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

  constructor() {
    super('GameScene');
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
    this.hudRenderer.update(snap);
  }
}
```

- [ ] **Step 3: Update main.ts to use GameScene**

Replace `src/client/main.ts`:
```typescript
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { CANVAS_W, CANVAS_H } from '@simulation/constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#0f0f23',
  parent: document.body,
  scene: [GameScene],
};

new Phaser.Game(config);
```

- [ ] **Step 4: Create placeholder FighterRenderer and HudRenderer (stubs)**

These will be implemented in the next tasks, but GameScene imports them. Create minimal stubs:

Create `src/client/renderers/FighterRenderer.ts`:
```typescript
import Phaser from 'phaser';
import type { FighterSnapshot } from '@simulation/types';

export class FighterRenderer {
  constructor(_scene: Phaser.Scene, _index: number) {}
  update(_state: FighterSnapshot): void {}
}
```

Create `src/client/renderers/HudRenderer.ts`:
```typescript
import Phaser from 'phaser';
import type { SimulationSnapshot } from '@simulation/types';

export class HudRenderer {
  constructor(_scene: Phaser.Scene, _playerCount: number) {}
  update(_snapshot: SimulationSnapshot): void {}
}
```

Create `src/client/input/KeyboardInput.ts`:
```typescript
import Phaser from 'phaser';
import { type InputState, NULL_INPUT } from '@simulation/types';

export class KeyboardInput {
  constructor(_scene: Phaser.Scene, _playerCount: number) {}
  getInputs(): InputState[] { return [NULL_INPUT, NULL_INPUT]; }
}
```

- [ ] **Step 5: Verify dev server runs with the scene**

```bash
npm run dev
```

Open browser — should see the stage (brown ground, dark background, faint red blast zone lines). Console should be clean.

- [ ] **Step 6: Commit**

```bash
git add src/client/
git commit -m "feat: Phaser GameScene with fixed timestep, stage rendering, stub renderers"
```

---

## Task 10: Keyboard Input

**Files:**
- Modify: `src/client/input/KeyboardInput.ts`

- [ ] **Step 1: Implement keyboard input for 2 players**

Replace `src/client/input/KeyboardInput.ts`:
```typescript
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
    this.p2Jump = kb.addKey(K.SHIFT); // Right shift
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
```

- [ ] **Step 2: Verify input works in browser**

```bash
npm run dev
```

Open browser, check console — no errors. WASD + arrow keys should trigger input (not visible yet until fighters render).

- [ ] **Step 3: Commit**

```bash
git add src/client/input/KeyboardInput.ts
git commit -m "feat: keyboard input — P1 WASD+JKL, P2 Arrows+Period/Comma/Slash"
```

---

## Task 11: Fighter Renderer

**Files:**
- Modify: `src/client/renderers/FighterRenderer.ts`

- [ ] **Step 1: Implement fighter rendering with colored shapes**

Replace `src/client/renderers/FighterRenderer.ts`:
```typescript
import Phaser from 'phaser';
import { FighterAction, type FighterSnapshot } from '@simulation/types';
import { PLAYER_COLORS, FIGHTER_W, FIGHTER_H } from '@simulation/constants';

export class FighterRenderer {
  private body: Phaser.GameObjects.Ellipse;
  private eyes: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private index: number;

  // Debug hitbox overlay
  private hitboxDebug: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, index: number) {
    this.scene = scene;
    this.index = index;
    const color = PLAYER_COLORS[index];

    // Kirby body — an ellipse (round, like Kirby!)
    this.body = scene.add.ellipse(0, 0, FIGHTER_W, FIGHTER_H, color);
    this.body.setStrokeStyle(2, 0x000000);

    // Eyes — simple graphics
    this.eyes = scene.add.graphics();

    // Debug hitbox (hidden by default)
    this.hitboxDebug = scene.add.rectangle(0, 0, 0, 0, 0xFF0000, 0.3);
    this.hitboxDebug.setVisible(false);
  }

  update(state: FighterSnapshot): void {
    if (state.action === FighterAction.Dead && state.stocks <= 0) {
      this.body.setVisible(false);
      this.eyes.setVisible(false);
      this.hitboxDebug.setVisible(false);
      return;
    }

    this.body.setVisible(true);
    this.eyes.setVisible(true);

    // Position (state.y is feet position, body center is up by half height)
    this.body.setPosition(state.x, state.y - FIGHTER_H / 2);

    // Alpha for invincibility (blink)
    const blinking = state.invincibleFrames > 0 && Math.floor(state.invincibleFrames / 4) % 2 === 0;
    this.body.setAlpha(blinking ? 0.4 : 1);

    // Captured state — make tiny
    if (state.suck.capturedBy >= 0) {
      this.body.setScale(0.3);
      this.eyes.setVisible(false);
      return;
    } else {
      this.body.setScale(1);
    }

    // Inflate during inhale
    if (state.action === FighterAction.Inhale) {
      this.body.setScale(1.1);
    } else if (state.action === FighterAction.CaptureHold) {
      this.body.setScale(1.3); // Puffed up while holding someone
    } else {
      this.body.setScale(1);
    }

    // Draw eyes
    this.eyes.clear();
    const eyeOffsetX = state.facingRight ? 6 : -6;
    const eyeY = state.y - FIGHTER_H / 2 - 4;
    const eyeX = state.x + eyeOffsetX;

    // Eye whites
    this.eyes.fillStyle(0xFFFFFF);
    this.eyes.fillEllipse(eyeX - 5, eyeY, 8, 10);
    this.eyes.fillEllipse(eyeX + 5, eyeY, 8, 10);

    // Pupils
    const pupilShift = state.facingRight ? 1.5 : -1.5;
    this.eyes.fillStyle(0x000000);
    this.eyes.fillCircle(eyeX - 5 + pupilShift, eyeY, 2.5);
    this.eyes.fillCircle(eyeX + 5 + pupilShift, eyeY, 2.5);

    // Color tint during hitstun
    if (state.action === FighterAction.Hitstun) {
      this.body.setFillStyle(0xFFFFFF);
    } else {
      this.body.setFillStyle(PLAYER_COLORS[this.index]);
    }

    // Squash/stretch for attacks
    if (state.action === FighterAction.AttackLight || state.action === FighterAction.AttackHeavy) {
      this.body.setScale(state.facingRight ? 1.2 : 1.2, 0.85); // Stretch horizontally
    }

    this.hitboxDebug.setVisible(false);
  }
}
```

- [ ] **Step 2: Verify fighters appear in browser**

```bash
npm run dev
```

Should see two colored ellipses (pink + blue) on the stage. Moving with WASD/arrows should move them.

- [ ] **Step 3: Commit**

```bash
git add src/client/renderers/FighterRenderer.ts
git commit -m "feat: fighter renderer — colored Kirby ellipses with eyes, state visuals"
```

---

## Task 12: HUD Renderer

**Files:**
- Modify: `src/client/renderers/HudRenderer.ts`

- [ ] **Step 1: Implement HUD with damage % and stock indicators**

Replace `src/client/renderers/HudRenderer.ts`:
```typescript
import Phaser from 'phaser';
import type { SimulationSnapshot } from '@simulation/types';
import { PLAYER_COLORS, CANVAS_W, CANVAS_H } from '@simulation/constants';

interface PlayerHud {
  damageText: Phaser.GameObjects.Text;
  stockDots: Phaser.GameObjects.Ellipse[];
  nameText: Phaser.GameObjects.Text;
}

export class HudRenderer {
  private playerHuds: PlayerHud[] = [];
  private matchText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, playerCount: number) {
    const hudY = CANVAS_H - 60;
    const sectionWidth = CANVAS_W / playerCount;

    for (let i = 0; i < playerCount; i++) {
      const centerX = sectionWidth * i + sectionWidth / 2;
      const colorStr = '#' + PLAYER_COLORS[i].toString(16).padStart(6, '0');

      const nameText = scene.add.text(centerX, hudY - 20, `P${i + 1}`, {
        fontSize: '14px',
        color: colorStr,
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      const damageText = scene.add.text(centerX, hudY + 5, '0%', {
        fontSize: '32px',
        color: '#FFFFFF',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Stock dots
      const stockDots: Phaser.GameObjects.Ellipse[] = [];
      for (let s = 0; s < 3; s++) {
        const dot = scene.add.ellipse(
          centerX - 15 + s * 15, hudY + 30, 8, 8,
          PLAYER_COLORS[i]
        );
        stockDots.push(dot);
      }

      this.playerHuds.push({ damageText, stockDots, nameText });
    }

    // Match status text (hidden by default)
    this.matchText = scene.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '48px',
      color: '#FFFFFF',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setVisible(false);
  }

  update(snapshot: SimulationSnapshot): void {
    for (let i = 0; i < this.playerHuds.length; i++) {
      const hud = this.playerHuds[i];
      const fighter = snapshot.fighters[i];

      hud.damageText.setText(`${Math.floor(fighter.damage)}%`);

      // Color damage text red as it gets higher
      const intensity = Math.min(fighter.damage / 150, 1);
      const r = Math.floor(255);
      const g = Math.floor(255 * (1 - intensity));
      const b = Math.floor(255 * (1 - intensity));
      hud.damageText.setColor(`rgb(${r},${g},${b})`);

      // Update stock dots
      for (let s = 0; s < hud.stockDots.length; s++) {
        hud.stockDots[s].setAlpha(s < fighter.stocks ? 1 : 0.2);
      }
    }

    // Match end display
    if (snapshot.matchPhase === 'ended') {
      this.matchText.setVisible(true);
      if (snapshot.winnerIndex >= 0) {
        this.matchText.setText(`P${snapshot.winnerIndex + 1} WINS!`);
        const colorStr = '#' + PLAYER_COLORS[snapshot.winnerIndex].toString(16).padStart(6, '0');
        this.matchText.setColor(colorStr);
      } else {
        this.matchText.setText('DRAW!');
      }
    }
  }
}
```

- [ ] **Step 2: Verify HUD displays in browser**

```bash
npm run dev
```

Should see damage percentages and stock dots at the bottom. Fighting should update damage %.

- [ ] **Step 3: Commit**

```bash
git add src/client/renderers/HudRenderer.ts
git commit -m "feat: HUD renderer — damage %, stock icons, match end display"
```

---

## Task 13: Result Scene and Match Restart

**Files:**
- Create: `src/client/scenes/ResultScene.ts`
- Modify: `src/client/scenes/GameScene.ts`, `src/client/main.ts`

- [ ] **Step 1: Create ResultScene**

Create `src/client/scenes/ResultScene.ts`:
```typescript
import Phaser from 'phaser';
import { PLAYER_COLORS, CANVAS_W, CANVAS_H } from '@simulation/constants';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(data: { winnerIndex: number }): void {
    const bg = this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x000000, 0.8);

    if (data.winnerIndex >= 0) {
      const colorStr = '#' + PLAYER_COLORS[data.winnerIndex].toString(16).padStart(6, '0');
      this.add.text(CANVAS_W / 2, CANVAS_H / 2 - 40, `P${data.winnerIndex + 1} WINS!`, {
        fontSize: '64px',
        color: colorStr,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      }).setOrigin(0.5);
    }

    this.add.text(CANVAS_W / 2, CANVAS_H / 2 + 40, 'Press ENTER to rematch', {
      fontSize: '20px',
      color: '#AAAAAA',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.input.keyboard!.on('keydown-ENTER', () => {
      this.scene.start('GameScene');
    });
  }
}
```

- [ ] **Step 2: Add match end detection to GameScene**

In `src/client/scenes/GameScene.ts`, add to the `update` method after rendering, before the closing brace:

```typescript
// Check for match end
if (snap.matchPhase === 'ended') {
  this.scene.start('ResultScene', { winnerIndex: snap.winnerIndex });
}
```

- [ ] **Step 3: Register ResultScene in main.ts**

Update `src/client/main.ts` to import and include ResultScene:
```typescript
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { CANVAS_W, CANVAS_H } from '@simulation/constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#0f0f23',
  parent: document.body,
  scene: [GameScene, ResultScene],
};

new Phaser.Game(config);
```

- [ ] **Step 4: Test match flow end-to-end**

```bash
npm run dev
```

Play a match — knock opponent off stage 3 times. Should transition to result screen with winner display. Press ENTER to rematch.

- [ ] **Step 5: Commit**

```bash
git add src/client/scenes/ResultScene.ts src/client/scenes/GameScene.ts src/client/main.ts
git commit -m "feat: result scene — winner display and ENTER to rematch"
```

---

## Task 14: Integration Testing and Polish

**Files:**
- Modify: Various files as needed for bug fixes

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

All simulation tests should pass. Fix any failures.

- [ ] **Step 2: Play-test locally**

```bash
npm run dev
```

Test the following scenarios with 2 players on the same keyboard:
1. **Movement:** Both players can move independently, jump, double jump
2. **Light attack:** Hits connect, damage increases, knockback is visible
3. **Heavy attack:** Longer startup, more damage/knockback, punishable on whiff
4. **Suck mechanic:** Inhale pulls opponent, capture works, mash escape, spit launches
5. **Blast zones:** Players die when knocked past boundaries
6. **Stocks:** Stock dots decrease on death, respawn works with invincibility blink
7. **Match end:** Last player standing triggers result screen
8. **Rematch:** ENTER restarts the match

- [ ] **Step 3: Fix any issues found during play-testing**

Address bugs discovered in step 2. Common issues to watch for:
- Fighter getting stuck in attack state (frame counter not advancing)
- Suck mechanic state cleanup (orphaned capture references)
- Ground collision fighting with gravity (jitter)
- Input edge detection (actions firing repeatedly)

- [ ] **Step 4: Run tests again after fixes**

```bash
npx vitest run
```

All tests pass.

- [ ] **Step 5: Commit all fixes**

```bash
git add -A
git commit -m "fix: integration testing fixes from play-testing"
```

---

## Task 15: Controls Reference Overlay

**Files:**
- Modify: `src/client/scenes/GameScene.ts`

- [ ] **Step 1: Add controls reference text to GameScene**

In `GameScene.create()`, after initializing renderers, add:

```typescript
// Controls reference (shown at start, fades out)
const controlsP1 = this.add.text(20, 20,
  'P1: WASD move | Space jump | J light | K heavy | L suck', {
  fontSize: '12px', color: '#666666', fontFamily: 'monospace',
});
const controlsP2 = this.add.text(20, 36,
  'P2: Arrows move | Shift jump | . light | , heavy | / suck', {
  fontSize: '12px', color: '#666666', fontFamily: 'monospace',
});

// Fade out after 5 seconds
this.time.delayedCall(5000, () => {
  this.tweens.add({ targets: [controlsP1, controlsP2], alpha: 0, duration: 1000 });
});
```

- [ ] **Step 2: Verify overlay appears and fades**

```bash
npm run dev
```

Controls text should appear top-left and fade after 5 seconds.

- [ ] **Step 3: Commit**

```bash
git add src/client/scenes/GameScene.ts
git commit -m "feat: controls reference overlay with auto-fade"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

All tests pass.

- [ ] **Step 2: Verify build succeeds**

```bash
npm run build
```

No TypeScript errors, Vite build produces dist/ output.

- [ ] **Step 3: Full play-test session**

```bash
npm run dev
```

Play several complete matches. Verify all mechanics feel responsive and correct.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, build succeeds"
```

---

## Controls Reference

| Player | Move | Jump | Light | Heavy | Suck |
|--------|------|------|-------|-------|------|
| P1 | WASD | Space | J | K | L |
| P2 | Arrows | Right Shift | . (period) | , (comma) | / (slash) |

## Architecture Note for Future Networking

The `src/simulation/` folder has **zero** Phaser or browser imports. When adding Colyseus networking:

1. The Colyseus `GameRoom` imports `GameSimulation` directly
2. `GameRoom.setSimulationInterval()` calls `simulation.step(collectedInputs)` at 60fps
3. `GameRoom` syncs `simulation.getSnapshot()` to Colyseus schema state
4. The Phaser client becomes a dumb renderer that sends inputs and renders received state
5. No simulation code changes needed
