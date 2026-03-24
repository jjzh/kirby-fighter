# Suck Shield — Design Spec

Gate the suck/capture mechanic behind a per-fighter shield that must be broken by attacks before inhale can capture. Creates a "work them down, then suck" loop and adds multiplayer texture around vulnerable targets.

## Motivation

Suck is too powerful for control hijacking to be freely available from frame one. Capturing an opponent should be a reward for landing attacks, not a default opener. In multiplayer, a visible shield state creates focus-fire dynamics and peel decisions around vulnerable targets.

## Core Mechanic

Each fighter has a **suck shield** with 5 hit points. Any attack (light or heavy) that connects removes 1 HP from the target's shield. While the shield has HP remaining, inhale cannot capture the target. Once the shield is depleted (0 HP), the target becomes vulnerable to suck capture. After being captured and released (spit or escape), the shield resets to full.

## Rules

| Event | Shield Effect |
|-------|---------------|
| Light attack connects | Target loses 1 shield HP |
| Heavy attack connects | Target loses 1 shield HP (charge multiplier does NOT scale shield damage) |
| Projectile impact on target | Target loses 1 shield HP |
| Inhale on shielded target (HP > 0) | Pull works, capture blocked |
| Inhale on unshielded target (HP = 0) | Capture succeeds (existing behavior) |
| Captured → spit out (projectile impact or travel timeout) | Shield resets to 5 |
| Captured → mash escape | Shield resets to 5 |
| Respawn | Shield resets to 5 |
| No timer/regen | Shield stays at current value indefinitely |

**Not shield damage:** Projectile self-damage (5% on impact) does not affect the spit fighter's own shield. Inhale pull does not affect shield.

## Simulation Changes

### Fighter State
- Add `suckShield: number` to `Fighter` class, default value `5`
- Add `SUCK_SHIELD_MAX = 5` constant to `src/simulation/constants.ts`
- Add `resetSuckShield()` helper method on `Fighter`: sets `this.suckShield = SUCK_SHIELD_MAX`. All reset sites call this instead of setting the value directly.
- Expose in `FighterSnapshot`

### Attack Resolution (`GameSimulation.resolveAttackHits`)
- When an attack hits a defender, decrement `defender.suckShield` by 1 (floor at 0)
- This happens alongside existing damage application — same hit, same frame

### Projectile Impact (`suck.ts` — `applyProjectileImpact`)
- When a projectile fighter hits a target, decrement `target.suckShield` by 1 (floor at 0)
- This happens alongside existing projectile damage/knockback application

### Inhale Gate (`GameSimulation.processSuckForFighter`)
- In `processSuckForFighter`, after `processInhale` returns a `captureTarget >= 0`, check `victim.suckShield === 0` before calling `startCapture`
- If shield is up (> 0), skip `startCapture` — inhale pull still works (existing vacuum cone behavior) but capture is blocked
- No change to pull speed, range, or cone geometry

### Shield Reset — All Exit Paths From Capture

Every path that ends a capture must reset the victim's shield to full:

- `releaseCapture` (mash escape): reset victim's `suckShield` to `SUCK_SHIELD_MAX`
- `tickProjectile` → travel timeout (control regain): reset projectile fighter's `suckShield` to `SUCK_SHIELD_MAX`
- `tickProjectile` → ground collision: reset projectile fighter's `suckShield` to `SUCK_SHIELD_MAX`
- `applyProjectileImpact` (hit another fighter): reset projectile fighter's `suckShield` to `SUCK_SHIELD_MAX`
- `GameSimulation.cleanupSuckRelationship` (captor dies/respawns): reset freed victim's `suckShield` to `SUCK_SHIELD_MAX`
- `Fighter.respawn()`: reset own `suckShield` to `SUCK_SHIELD_MAX`

### Snapshot
- Add `suckShield: number` to `FighterSnapshot` interface

## HUD Changes

### Shield Bar (`HudRenderer`)

Added to the existing screen-space HUD panel (not world-space). Positioned between the damage % text and the stock dots.

- Add `shieldSegments: Phaser.GameObjects.Rectangle[]` to `PlayerHud` interface
- Create 5 small rectangles per player, arranged horizontally, centered under the damage text
- Each segment: ~12px wide, ~4px tall, ~2px gap between segments. Total width ≈ 68px
- Position: `hudY + 22` (between damage text at `hudY + 5` and stock dots at `hudY + 30` — shift stock dots down to `hudY + 34` to make room)
- Fill color: player's color when shield HP remains, dark gray (`0x333333`) when depleted
- Update each frame: segment `i` is filled if `suckShield > i`, gray otherwise

## What Doesn't Change
- Suck range scaling (still based on victim damage %)
- Mash-to-escape count (still based on victim damage %)
- Launch speed scaling (still based on victim damage %)
- Damage % system (completely independent resource)
- Inhale pull behavior (cone, speed, range — all unchanged)
- Projectile mechanics (self-damage, impact knockback)

## Scope Boundaries
- **In scope:** suckShield property, attack decrement, capture gate, shield reset on release/respawn, HUD bar
- **Out of scope:** charge-scaled shield damage (always 1 regardless of charge), shield regen timer, visual effects on break (flash, sound), shield affecting suck range or mash count
