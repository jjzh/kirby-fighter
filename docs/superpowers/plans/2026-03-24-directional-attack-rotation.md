# Directional Attack Rotation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rotate Kirby's sprite and reposition attack hitboxes to match the player's aimed direction during attacks, with visual rotation clamped to ±70°.

**Architecture:** Add `aimDirection: Vec2` to `Fighter`, captured/updated during attack states and reset via `setAction()` for all non-attack states. `getAttackHitbox` offsets along the aim vector instead of horizontally. `FighterRenderer` reads the aim direction from the snapshot and sets `sprite.angle` during attack states.

**Tech Stack:** TypeScript, Phaser 3.90.0, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-directional-attack-rotation-design.md`

---

## File Structure

```
src/simulation/
├── types.ts              # Add aimDirection to FighterSnapshot
├── Fighter.ts            # Add aimDirection property, reset logic in setAction()
├── combat.ts             # Wire aimDirection into processAttack, update getAttackHitbox
├── GameSimulation.ts     # Use stored aimDirection for knockback instead of re-computing
└── __tests__/
    └── combat.test.ts    # Tests for aim capture, charge preview, hitbox placement

src/client/
└── renderers/
    └── FighterRenderer.ts  # Sprite rotation + debug hitbox with aimDirection
```

---

## Task 1: Add aimDirection to Fighter and FighterSnapshot

**Files:**
- Modify: `src/simulation/types.ts:101-116` (FighterSnapshot interface)
- Modify: `src/simulation/Fighter.ts:15-96` (Fighter class)
- Test: `src/simulation/__tests__/combat.test.ts`

- [ ] **Step 1: Add aimDirection to FighterSnapshot**

In `src/simulation/types.ts`, add to the `FighterSnapshot` interface:

```typescript
aimDirection: Vec2;
```

- [ ] **Step 2: Add aimDirection property to Fighter class**

In `src/simulation/Fighter.ts`, add the property after `heavyChargeFrames`:

```typescript
aimDirection: Vec2 = { x: 1, y: 0 };
```

- [ ] **Step 3: Update setAction to reset aimDirection for non-attack states**

Replace `setAction` in `Fighter.ts`:

```typescript
private static readonly AIMED_ACTIONS = new Set([
  FighterAction.AttackLight,
  FighterAction.AttackHeavy,
  FighterAction.ChargeHeavy,
]);

setAction(action: FighterAction): void {
  if (this.action !== action) {
    this.action = action;
    this.actionFrame = 0;
    if (!Fighter.AIMED_ACTIONS.has(action)) {
      this.aimDirection = { x: this.facingRight ? 1 : -1, y: 0 };
    }
  }
}
```

- [ ] **Step 4: Update snapshot() to include aimDirection**

In `Fighter.ts`, add to the `snapshot()` return object:

```typescript
aimDirection: { ...this.aimDirection },
```

- [ ] **Step 5: Update respawn() to reset aimDirection**

In `Fighter.ts`, add to `respawn()`:

```typescript
this.aimDirection = { x: 1, y: 0 };
```

- [ ] **Step 6: Write test — aimDirection resets on non-attack state transition**

In `combat.test.ts`, add:

```typescript
describe('aimDirection reset', () => {
  it('resets aimDirection to facing direction on non-attack state', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    f.aimDirection = { x: 0, y: -1 }; // Was aiming up
    f.setAction(FighterAction.Hitstun);
    expect(f.aimDirection).toEqual({ x: 1, y: 0 });
  });

  it('preserves aimDirection when transitioning between attack states', () => {
    const f = new Fighter(0, 500, 580);
    f.aimDirection = { x: 0, y: -1 };
    f.action = FighterAction.ChargeHeavy;
    f.setAction(FighterAction.AttackHeavy);
    expect(f.aimDirection).toEqual({ x: 0, y: -1 });
  });

  it('resets to left when facing left', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = false;
    f.aimDirection = { x: 0, y: -1 };
    f.setAction(FighterAction.Idle);
    expect(f.aimDirection).toEqual({ x: -1, y: 0 });
  });
});
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/simulation/__tests__/combat.test.ts`
Expected: all new tests pass, existing tests pass

- [ ] **Step 8: Commit**

```bash
git add src/simulation/types.ts src/simulation/Fighter.ts src/simulation/__tests__/combat.test.ts
git commit -m "feat: add aimDirection to Fighter with reset on non-attack states"
```

---

## Task 2: Wire aimDirection into processAttack

**Files:**
- Modify: `src/simulation/combat.ts:138-166` (processAttack function)
- Test: `src/simulation/__tests__/combat.test.ts`

- [ ] **Step 1: Write tests for aim capture behavior**

In `combat.test.ts`, add:

```typescript
describe('processAttack aimDirection', () => {
  it('captures aimDirection on light attack start', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    const input = { ...NULL_INPUT, light: true, up: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.AttackLight);
    expect(f.aimDirection.y).toBe(-1); // aiming up
  });

  it('updates aimDirection each frame during ChargeHeavy', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    f.action = FighterAction.ChargeHeavy;
    f.actionFrame = 5;
    const input = { ...NULL_INPUT, heavy: true, up: true };
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.ChargeHeavy); // still charging
    expect(f.aimDirection.y).toBe(-1); // updated to up
  });

  it('locks aimDirection on heavy release', () => {
    const f = new Fighter(0, 500, 580);
    f.facingRight = true;
    f.action = FighterAction.ChargeHeavy;
    f.actionFrame = 20;
    const input = { ...NULL_INPUT, up: true }; // heavy released, aiming up
    processAttack(f, input);
    expect(f.action).toBe(FighterAction.AttackHeavy);
    expect(f.aimDirection.y).toBe(-1); // locked at release
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/simulation/__tests__/combat.test.ts`
Expected: new aimDirection tests fail (aimDirection not being set in processAttack yet)

- [ ] **Step 3: Update processAttack to set aimDirection**

In `combat.ts`, modify `processAttack`:

```typescript
export function processAttack(fighter: Fighter, input: InputState): void {
  // Handle charge release → fire heavy attack
  if (fighter.action === FighterAction.ChargeHeavy) {
    // Update aim preview every frame during charge
    fighter.aimDirection = getAimDirection(input, fighter.facingRight);
    if (!input.heavy) {
      // Released — capture final aim, store charge duration, fire the heavy attack
      fighter.heavyChargeFrames = fighter.actionFrame;
      const finalAim = { ...fighter.aimDirection };
      fighter.setAction(FighterAction.AttackHeavy);
      fighter.aimDirection = finalAim; // restore after setAction reset
    }
    return;
  }

  const inAttack = fighter.action === FighterAction.AttackLight ||
                   fighter.action === FighterAction.AttackHeavy;
  if (inAttack) return;

  const canAttack = fighter.action === FighterAction.Idle ||
                    fighter.action === FighterAction.Run ||
                    fighter.action === FighterAction.Airborne;
  if (!canAttack) return;

  const lightJustPressed = input.light && !fighter.prevLightPressed;
  const heavyJustPressed = input.heavy && !fighter.prevHeavyPressed;

  if (lightJustPressed) {
    const aim = getAimDirection(input, fighter.facingRight);
    fighter.setAction(FighterAction.AttackLight);
    fighter.aimDirection = aim; // set after setAction (which would reset it)
  } else if (heavyJustPressed) {
    fighter.setAction(FighterAction.ChargeHeavy);
    fighter.aimDirection = getAimDirection(input, fighter.facingRight);
  }
}
```

Key detail: for light attack and heavy release, we capture the aim BEFORE `setAction` (which resets it for ChargeHeavy→AttackHeavy), then restore it after. For ChargeHeavy→AttackHeavy specifically, `setAction` won't reset because AttackHeavy is in the aimed actions set — but for light, `setAction(AttackLight)` also won't reset since it's in the set. So actually we can set aim after `setAction` directly. However, the pattern of capturing then restoring is safer in case the set changes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/simulation/__tests__/combat.test.ts`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/simulation/combat.ts src/simulation/__tests__/combat.test.ts
git commit -m "feat: capture aimDirection in processAttack for light, charge, and release"
```

---

## Task 3: Update getAttackHitbox to use aimDirection

**Files:**
- Modify: `src/simulation/combat.ts:109-118` (getAttackHitbox function)
- Test: `src/simulation/__tests__/combat.test.ts`

- [ ] **Step 1: Write tests for aimed hitbox placement**

In `combat.test.ts`, update the `getAttackHitbox` describe block:

```typescript
describe('getAttackHitbox', () => {
  it('places hitbox along aimDirection (right)', () => {
    const f = new Fighter(0, 500, 580);
    f.aimDirection = { x: 1, y: 0 };
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeGreaterThan(500); // offset right
    expect(hb.y).toBeCloseTo(580 - 48 / 2); // centered vertically
  });

  it('places hitbox along aimDirection (up)', () => {
    const f = new Fighter(0, 500, 580);
    f.aimDirection = { x: 0, y: -1 };
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeCloseTo(500); // no horizontal offset
    expect(hb.y).toBeLessThan(580 - 48 / 2); // offset upward
  });

  it('places hitbox along aimDirection (diagonal up-right)', () => {
    const f = new Fighter(0, 500, 580);
    const d = Math.SQRT1_2;
    f.aimDirection = { x: d, y: -d };
    const hb = getAttackHitbox(f, 'light');
    expect(hb.x).toBeGreaterThan(500); // some rightward offset
    expect(hb.y).toBeLessThan(580 - 48 / 2); // some upward offset
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/simulation/__tests__/combat.test.ts`
Expected: the "up" and "diagonal" tests fail (hitbox still placed horizontally)

- [ ] **Step 3: Update getAttackHitbox to use aimDirection**

In `combat.ts`, replace `getAttackHitbox`:

```typescript
export function getAttackHitbox(fighter: Fighter, type: string): Rect {
  const data = ATTACK_DATA[type];
  return {
    x: fighter.x + fighter.aimDirection.x * data.hitboxOffsetX,
    y: (fighter.y - FIGHTER_H / 2) + fighter.aimDirection.y * data.hitboxOffsetX,
    w: data.hitboxW,
    h: data.hitboxH,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/simulation/__tests__/combat.test.ts`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/simulation/combat.ts src/simulation/__tests__/combat.test.ts
git commit -m "feat: offset attack hitbox along aimDirection vector"
```

---

## Task 4: Use stored aimDirection for knockback in GameSimulation

**Files:**
- Modify: `src/simulation/GameSimulation.ts:144-189` (resolveAttackHits)
- Test: `src/simulation/__tests__/GameSimulation.test.ts`

- [ ] **Step 1: Update resolveAttackHits to use attacker.aimDirection**

In `GameSimulation.ts`, in `resolveAttackHits`, replace line 162:

```typescript
// OLD:
const aimDir = getAimDirection(inputs[attackerIdx], attacker.facingRight);
// NEW:
const aimDir = attacker.aimDirection;
```

Remove `inputs` parameter from `resolveAttackHits` signature and call site (line 94), since it's no longer needed:

```typescript
// In step() — line 94:
this.resolveAttackHits();

// Method signature:
private resolveAttackHits(): void {
```

Also remove `getAimDirection` from the import if no longer used in this file (check first — `launchProjectile` in `processSuckForFighter` uses input directly, not through this file).

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: all tests pass (knockback direction now comes from stored aimDirection instead of re-reading input)

- [ ] **Step 3: Commit**

```bash
git add src/simulation/GameSimulation.ts
git commit -m "refactor: use stored aimDirection for knockback instead of re-computing from input"
```

---

## Task 5: Add sprite rotation to FighterRenderer

**Files:**
- Modify: `src/client/renderers/FighterRenderer.ts:80-139` (update method)

No unit tests — renderer is a Phaser-dependent visual layer. Verify manually.

- [ ] **Step 1: Add rotation constants**

At the top of `FighterRenderer.ts`, add:

```typescript
const AIM_ROTATION_CLAMP_DEG = 70;
```

- [ ] **Step 2: Add rotation logic to update method**

In `FighterRenderer.ts`, after the flipX line (`this.sprite.setFlipX(!state.facingRight)`) and before the invincibility blink, add the rotation block:

```typescript
// Sprite rotation based on aim direction during attacks
const isAimed = state.action === FighterAction.AttackLight ||
                state.action === FighterAction.AttackHeavy ||
                state.action === FighterAction.ChargeHeavy;
if (isAimed) {
  // Compute angle relative to horizontal forward
  const forwardX = state.facingRight ? 1 : -1;
  const dot = state.aimDirection.x * forwardX; // aimDir · forward (y component is 0)
  const cross = state.aimDirection.y * forwardX; // aimDir × forward (z component)
  let angleDeg = Math.atan2(cross, dot) * (180 / Math.PI);
  // Clamp
  angleDeg = Math.max(-AIM_ROTATION_CLAMP_DEG, Math.min(AIM_ROTATION_CLAMP_DEG, angleDeg));
  // When facing left (flipX), negate so "up" still tilts the right visual direction
  this.sprite.angle = state.facingRight ? angleDeg : -angleDeg;
} else {
  this.sprite.angle = 0;
}
```

- [ ] **Step 3: Update FighterAction import**

Ensure `ChargeHeavy` is accessible — it should already be in the `FighterAction` enum import.

- [ ] **Step 4: Update debug hitbox visualization**

In the debug section of `update()`, set `aimDirection` on the temporary fighter used for hitbox queries:

```typescript
// After existing tempFighter setup (around line 145-148), add:
tempFighter.aimDirection = state.aimDirection;
```

- [ ] **Step 5: Commit**

```bash
git add src/client/renderers/FighterRenderer.ts
git commit -m "feat: rotate sprite during attacks based on aimDirection, clamped ±70°"
```

---

## Task 6: Build, test, and push

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: clean build, no type errors

- [ ] **Step 3: Commit any remaining fixes and push**

```bash
git push
```
