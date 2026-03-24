# Suck Shield — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the suck/capture mechanic behind a 5-hit shield that must be broken by attacks before inhale can capture, with a HUD bar showing shield status.

**Architecture:** Add `suckShield` to `Fighter` with a `resetSuckShield()` helper. Attacks and projectile impacts decrement shield by 1. `processSuckForFighter` gates capture on `suckShield === 0`. All capture exit paths call `resetSuckShield()`. HUD renders a 5-segment bar per player.

**Tech Stack:** TypeScript, Phaser 3.90.0, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-suck-shield-design.md`

---

## File Structure

```
src/simulation/
├── constants.ts            # Add SUCK_SHIELD_MAX
├── types.ts                # Add suckShield to FighterSnapshot
├── Fighter.ts              # Add suckShield property + resetSuckShield() helper
├── GameSimulation.ts       # Shield decrement in resolveAttackHits, capture gate in processSuckForFighter, reset in cleanupSuckRelationship
├── suck.ts                 # Shield reset in releaseCapture, tickProjectile, applyProjectileImpact; shield decrement in applyProjectileImpact
└── __tests__/
    ├── suck.test.ts        # Shield gate, reset on capture exit
    └── GameSimulation.test.ts  # Shield decrement on attack hit

src/client/
└── renderers/
    └── HudRenderer.ts      # 5-segment shield bar per player
```

---

## Task 1: Add suckShield to Fighter, FighterSnapshot, and constants

**Files:**
- Modify: `src/simulation/constants.ts`
- Modify: `src/simulation/types.ts` (FighterSnapshot interface)
- Modify: `src/simulation/Fighter.ts`

- [ ] **Step 1: Add SUCK_SHIELD_MAX constant**

In `src/simulation/constants.ts`, add after the suck mechanic constants:

```typescript
export const SUCK_SHIELD_MAX = 5;
```

- [ ] **Step 2: Add suckShield to FighterSnapshot**

In `src/simulation/types.ts`, add to `FighterSnapshot`:

```typescript
suckShield: number;
```

- [ ] **Step 3: Add suckShield property and resetSuckShield() to Fighter**

In `src/simulation/Fighter.ts`:

Add the property after `suck`:
```typescript
suckShield: number = SUCK_SHIELD_MAX;
```

Add the import of `SUCK_SHIELD_MAX` from `./constants`.

Add the helper method:
```typescript
resetSuckShield(): void {
  this.suckShield = SUCK_SHIELD_MAX;
}
```

Update `snapshot()` to include:
```typescript
suckShield: this.suckShield,
```

Update `respawn()` to call:
```typescript
this.resetSuckShield();
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `npx vitest run`
Expected: all existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/simulation/constants.ts src/simulation/types.ts src/simulation/Fighter.ts
git commit -m "feat: add suckShield property to Fighter with resetSuckShield() helper"
```

---

## Task 2: Shield decrement on attack hit and capture gate

**Files:**
- Modify: `src/simulation/GameSimulation.ts` (resolveAttackHits, processSuckForFighter)
- Test: `src/simulation/__tests__/GameSimulation.test.ts`

- [ ] **Step 1: Write tests for shield decrement and capture gate**

In `GameSimulation.test.ts`, add:

```typescript
import { SUCK_SHIELD_MAX } from '../constants';

describe('suck shield', () => {
  it('decrements shield on attack hit', () => {
    const sim = new GameSimulation({ stocks: 3, playerCount: 2 }, STAGE);
    const snap0 = sim.getSnapshot();
    expect(snap0.fighters[1].suckShield).toBe(SUCK_SHIELD_MAX);

    // P1 light attack aimed at P2 — step until hit connects
    // P1 faces right (default), P2 is to the right
    const attackInput = { ...NULL_INPUT, light: true };
    sim.step([attackInput, NULL_INPUT]);

    // Advance through startup frames to active
    for (let i = 0; i < 10; i++) {
      sim.step([NULL_INPUT, NULL_INPUT]);
    }

    const snap1 = sim.getSnapshot();
    // Shield should have decremented by at least 1 if hit connected
    expect(snap1.fighters[1].suckShield).toBeLessThan(SUCK_SHIELD_MAX);
  });

  it('blocks capture when shield is up', () => {
    const sim = new GameSimulation({ stocks: 3, playerCount: 2 }, STAGE);

    // Position P2 right next to P1 (within capture distance of 30px)
    // Access fighters directly to set up the scenario
    const fighters = (sim as any).fighters;
    fighters[1].x = fighters[0].x + 25; // within CAPTURE_DISTANCE

    // P1 starts inhaling — P2 has full shield, should NOT be captured
    const suckInput = { ...NULL_INPUT, suck: true };
    sim.step([suckInput, NULL_INPUT]);
    // Step a few more frames to give inhale time to attempt capture
    for (let i = 0; i < 5; i++) {
      sim.step([suckInput, NULL_INPUT]);
    }

    const snap = sim.getSnapshot();
    expect(snap.fighters[1].suckShield).toBe(SUCK_SHIELD_MAX);
    // P2 should NOT be in capture_hold because shield is up
    expect(snap.fighters[1].action).not.toBe('capture_hold');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/simulation/__tests__/GameSimulation.test.ts`
Expected: suck shield tests fail

- [ ] **Step 3: Add shield decrement in resolveAttackHits**

In `GameSimulation.ts`, inside `resolveAttackHits`, after the `defender.damage += ...` line and before the knockback calculation, add:

```typescript
defender.suckShield = Math.max(0, defender.suckShield - 1);
```

- [ ] **Step 4: Add capture gate in processSuckForFighter**

In `GameSimulation.ts`, in `processSuckForFighter`, replace:

```typescript
const captureTarget = processInhale(fighter, this.fighters, index);
if (captureTarget >= 0) {
  startCapture(fighter, this.fighters[captureTarget], captureTarget, index);
}
```

With:

```typescript
const captureTarget = processInhale(fighter, this.fighters, index);
if (captureTarget >= 0 && this.fighters[captureTarget].suckShield === 0) {
  startCapture(fighter, this.fighters[captureTarget], captureTarget, index);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/simulation/GameSimulation.ts src/simulation/__tests__/GameSimulation.test.ts
git commit -m "feat: shield decrement on attack hit + capture gate on suckShield"
```

---

## Task 3: Shield reset on all capture exit paths + projectile impact decrement

**Files:**
- Modify: `src/simulation/suck.ts` (releaseCapture, tickProjectile, applyProjectileImpact)
- Modify: `src/simulation/GameSimulation.ts` (cleanupSuckRelationship)
- Test: `src/simulation/__tests__/suck.test.ts`

- [ ] **Step 1: Write tests for shield reset and projectile shield decrement**

In `suck.test.ts`, add imports for `releaseCapture`, `startCapture`, `applyProjectileImpact` and `SUCK_SHIELD_MAX`:

```typescript
import {
  isInInhaleCone, processInhale, processCapture,
  launchProjectile, tickProjectile,
  releaseCapture, startCapture, applyProjectileImpact,
} from '../suck';
import { SUCK_SHIELD_MAX } from '../constants';
```

Add test block:

```typescript
describe('suck shield reset', () => {
  it('resets shield on mash escape (releaseCapture)', () => {
    const sucker = new Fighter(0, 500, 580);
    const victim = new Fighter(1, 500, 580);
    victim.suckShield = 0; // was depleted to enable capture
    startCapture(sucker, victim, 1, 0);

    releaseCapture(sucker, victim);
    expect(victim.suckShield).toBe(SUCK_SHIELD_MAX);
  });

  it('resets shield on projectile timer expiry', () => {
    const stage = new Stage(STAGE);
    const f = new Fighter(0, 500, 400);
    f.suckShield = 0;
    f.action = FighterAction.Projectile;
    f.suck.projectileTimer = 1;
    f.suck.projectileVelocity = { x: 10, y: 0 };

    tickProjectile(f, stage);
    expect(f.action).not.toBe(FighterAction.Projectile);
    expect(f.suckShield).toBe(SUCK_SHIELD_MAX);
  });

  it('resets projectile shield and decrements target shield on impact', () => {
    const projectile = new Fighter(0, 500, 580);
    const target = new Fighter(1, 520, 580);
    projectile.suckShield = 0;
    projectile.action = FighterAction.Projectile;
    projectile.suck.projectileVelocity = { x: 10, y: 0 };
    target.suckShield = SUCK_SHIELD_MAX;

    applyProjectileImpact(projectile, target);
    expect(projectile.suckShield).toBe(SUCK_SHIELD_MAX); // reset
    expect(target.suckShield).toBe(SUCK_SHIELD_MAX - 1); // decremented
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/simulation/__tests__/suck.test.ts`
Expected: new tests fail

- [ ] **Step 3: Add shield reset to releaseCapture**

In `suck.ts`, in `releaseCapture`, after `victim.resetSuckState()`:

```typescript
victim.resetSuckShield();
```

- [ ] **Step 4: Add shield reset to tickProjectile**

In `suck.ts`, in `tickProjectile`, inside the `if (fighter.suck.projectileTimer <= 0 || hitGround)` block, after `fighter.resetSuckState()`:

```typescript
fighter.resetSuckShield();
```

- [ ] **Step 5: Add shield reset + target decrement to applyProjectileImpact**

In `suck.ts`, in `applyProjectileImpact`:

After `target.setAction(FighterAction.Hitstun)`, add:
```typescript
target.suckShield = Math.max(0, target.suckShield - 1);
```

After `projectile.resetSuckState()`, add:
```typescript
projectile.resetSuckShield();
```

- [ ] **Step 6: Add shield reset to cleanupSuckRelationship**

In `GameSimulation.ts`, in `cleanupSuckRelationship`:

After `victim.resetSuckState()` (in the captor-dies block), add:
```typescript
victim.resetSuckShield();
```

After `captor.resetSuckState()` (in the captive-dies block — captor gets freed), no shield reset needed for captor since the captor's shield was never depleted.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/simulation/suck.ts src/simulation/GameSimulation.ts src/simulation/__tests__/suck.test.ts
git commit -m "feat: shield reset on all capture exits + projectile impact decrements target shield"
```

---

## Task 4: HUD shield bar

**Files:**
- Modify: `src/client/renderers/HudRenderer.ts`

No unit tests — Phaser-dependent renderer. Verify visually.

- [ ] **Step 1: Add shieldSegments to PlayerHud and import SUCK_SHIELD_MAX**

In `HudRenderer.ts`, update the import to include `SUCK_SHIELD_MAX`:

```typescript
import { PLAYER_COLORS, CANVAS_W, CANVAS_H, SUCK_SHIELD_MAX } from '@simulation/constants';
```

Add `shieldSegments` to the `PlayerHud` interface:

```typescript
interface PlayerHud {
  damageText: Phaser.GameObjects.Text;
  shieldSegments: Phaser.GameObjects.Rectangle[];
  stockDots: Phaser.GameObjects.Ellipse[];
  nameText: Phaser.GameObjects.Text;
}
```

- [ ] **Step 2: Create shield segments in constructor**

In the constructor, after the `damageText` creation and before the stock dots, add:

```typescript
// Shield bar segments
const shieldSegments: Phaser.GameObjects.Rectangle[] = [];
const segW = 12;
const segH = 4;
const segGap = 2;
const totalW = SUCK_SHIELD_MAX * segW + (SUCK_SHIELD_MAX - 1) * segGap;
const shieldStartX = centerX - totalW / 2;
for (let s = 0; s < SUCK_SHIELD_MAX; s++) {
  const seg = scene.add.rectangle(
    shieldStartX + s * (segW + segGap) + segW / 2,
    hudY + 22,
    segW, segH,
    PLAYER_COLORS[i]
  );
  shieldSegments.push(seg);
}
```

Move stock dots Y position from `hudY + 30` to `hudY + 34`:

```typescript
centerX - 15 + s * 15, hudY + 34, 8, 8,
```

Update the `playerHuds.push` to include `shieldSegments`:

```typescript
this.playerHuds.push({ damageText, shieldSegments, stockDots, nameText });
```

- [ ] **Step 3: Add shieldSegments to getGameObjects**

In `getGameObjects`, update the push to include shield segments:

```typescript
objects.push(hud.nameText, hud.damageText, ...hud.shieldSegments, ...hud.stockDots);
```

- [ ] **Step 4: Update shield bar in update()**

In `update()`, inside the per-player loop, after the stock dots update, add:

```typescript
// Update shield segments
for (let s = 0; s < hud.shieldSegments.length; s++) {
  hud.shieldSegments[s].setFillStyle(
    fighter.suckShield > s ? PLAYER_COLORS[i] : 0x333333
  );
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 6: Commit**

```bash
git add src/client/renderers/HudRenderer.ts
git commit -m "feat: HUD shield bar — 5-segment display per player"
```

---

## Task 5: Build, test, and push

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: clean build

- [ ] **Step 3: Push**

```bash
git push
```
