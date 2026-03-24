# Directional Attack Rotation — Design Spec

Rotate Kirby's sprite and reposition attack hitboxes to match the player's aimed direction during attacks. Visual rotation is clamped to ±70° to avoid broken-looking poses from horizontally-drawn sprites.

## Motivation

Currently attacks always fire horizontally (toward `facingRight`) — the aim direction only affects knockback. This creates a disconnect: the player holds up+attack expecting to hit above them, but the hitbox is in front and the sprite doesn't move. This feature aligns visuals, hitbox placement, and knockback direction so they all agree.

## Behavior

### Light Attack
- Aim direction captured at the frame the attack starts (just-pressed)
- Locked for the attack's entire duration (startup → active → recovery)
- Sprite snaps to the aimed rotation instantly

### Heavy Charge → Release
- During `ChargeHeavy`: aim direction updates every frame from current directional input
- Sprite rotation previews the aim direction live during charge
- On release (transition to `AttackHeavy`): aim direction locks to whatever the player was holding at the moment of release
- Sprite rotation stays locked through the attack

### Non-Attack States
- `aimDirection` resets to facing direction (1,0) or (-1,0)
- `sprite.angle = 0` — Kirby is upright

## Simulation Changes

### Fighter State
- Add `aimDirection: Vec2` to `Fighter` class
- Default value: `{ x: 1, y: 0 }` (facing right) or `{ x: -1, y: 0 }` (facing left)
- Exposed in `FighterSnapshot`

### Attack Flow (`combat.ts`)
- `processAttack`:
  - Light just-pressed → capture `aimDirection` from `getAimDirection(input, facingRight)`, then `setAction(AttackLight)`
  - Heavy just-pressed → `setAction(ChargeHeavy)`, begin updating `aimDirection` each frame
  - During `ChargeHeavy` → update `aimDirection` from current input each frame
  - Heavy released → lock `aimDirection`, set `heavyChargeFrames`, transition to `AttackHeavy`

### Hitbox Placement (`getAttackHitbox`)
Current: offset hitbox horizontally by `hitboxOffsetX` based on `facingRight`

New: offset along `aimDirection` vector:
```
x: fighter.x + aimDirection.x * hitboxOffsetX
y: (fighter.y - FIGHTER_H / 2) + aimDirection.y * hitboxOffsetX
```

The hitbox rectangle stays axis-aligned (AABB). Only the center position moves. No OBB collision needed.

### Knockback
No change — `getAimDirection` already determines knockback direction independently.

## Renderer Changes

### Sprite Rotation (`FighterRenderer`)
- Read `aimAngle` from snapshot (computed as `Math.atan2(aimDirection.y, aimDirection.x)`)
- During `AttackLight`, `AttackHeavy`, `ChargeHeavy`:
  - Compute display angle relative to horizontal forward
  - Clamp to ±70°
  - When `flipX` is true (facing left), negate the rotation to maintain visual consistency
  - Set `sprite.angle` in degrees
- All other states: `sprite.angle = 0`

### Debug Hitbox Visualization
No change needed — already reads from `getAttackHitbox`, which will automatically reflect the new aimed position.

## What Doesn't Change
- Inhale/suck direction (stays forward-only, no rotation)
- `checkHitboxOverlap` (stays AABB)
- Knockback calculation
- Animation selection (same animations regardless of aim)

## Edge Cases
- **FlipX + rotation sign**: when sprite is flipped, Phaser's rotation axis flips too. Renderer must negate rotation angle when facing left.
- **Axis-aligned hitbox when aiming straight up**: a 35×30 hitbox placed directly above Kirby is wide-but-short. At these sizes the difference from a rotated rectangle is negligible. Revisit if feel is off.
- **Aim during hitstun interruption**: if hit mid-attack, transition to hitstun resets rotation to 0. The snap is masked by hitstun's white flash + knockback velocity.

## Scope Boundaries
- **In scope:** Light attack, heavy charge + release, hitbox repositioning, sprite rotation, debug vis
- **Out of scope:** Inhale/suck rotation, rotated hitbox collision (OBB), directional animation variants, aerial aim-specific sprites
