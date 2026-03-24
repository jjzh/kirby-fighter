# Kirby Platform Fighter — Design Spec

A 2D platform fighter for web with local network (same-WiFi) multiplayer. Smash Bros 64 as the mechanical foundation, with Kirby's signature suck/spit mechanic as the core differentiator.

## Core Concept

All players play as Kirby in symmetric mirror matches. Quick attacks build knockback percentage on opponents; higher percentage means further knockback. Knock a player past the blast zone to take a stock. The suck mechanic lets Kirby inhale opponents and spit them as projectiles — creating a dynamic where high-% players become both vulnerable and dangerous as ammo.

## Match Format

- **Players:** 2–4 per match, all Kirby (differentiated by color)
- **Stocks:** 3 lives per player
- **Win condition:** Last player with stocks remaining
- **Respawn:** Above center stage, ~2 seconds of invincibility

## Stage

Flat ground plane (Final Destination style). No platforms in v1. Blast zones surround the stage — crossing any blast zone boundary kills the player and removes a stock. Players can walk off edges.

## Moveset

Four verbs. All attacks use the direction held at the moment of input (or facing direction if neutral). No directional variants in v1 — same animation regardless of aim direction, just fired in the aimed direction.

| Verb | Desktop Key | Description |
|------|-------------|-------------|
| Light attack | J | Fast, short range melee. ~5% damage, low knockback. |
| Heavy attack | K | Slower startup, longer range. ~12–15% damage, stronger knockback. Punishable on whiff. |
| Suck (inhale) | L | Hold to create vacuum cone. See Suck Mechanic below. |
| Jump | Space | Single jump + one mid-air double jump (classic Kirby). |

Movement: WASD (A/D = run left/right, W = up directional input for attacks, S = crouch/down aim). Standard platformer gravity.

## Suck Mechanic

The defining mechanic. Three phases:

### Phase 1: Inhale
- Hold L to activate a continuous vacuum cone in front of Kirby
- Enemies within the cone are pulled toward Kirby
- **Range scales with victim's damage %:** low % = close range only, high % = up to half-stage reach

### Phase 2: Capture
- Enemy pulled to Kirby is captured (held inside)
- Kirby can move while holding, but at reduced speed
- **Escape system: mash-gated.** Captured player mashes J (light attack) to fill an escape meter. When the meter fills, they break free.
- **Mashes required to escape scales with victim's damage %:** 0% = 5 mashes, 50% = 10 mashes, 100%+ = 15+ mashes
- **Minimum hold time floor:** regardless of mash speed, the capture lasts at least 1 second before escape is possible

### Phase 3: Release
- Press L again to spit the captured player as a projectile in the aimed direction
- **Launch speed scales with victim's damage %:** higher % = faster launch
- The projectile player is a hitbox — collides with other players on contact
- Damage and knockback dealt to the impact target scale with projectile speed
- The projectile player takes self-damage on impact: flat ~5% regardless of speed (punishes reckless suck usage but doesn't scale — the victim already suffers from being launched)
- Projectile player regains control after hitting something or after ~0.5 seconds of travel (long enough to cross a significant portion of the stage but not an automatic death sentence if aimed toward a blast zone)

### Suck Scaling Table

The 1-second minimum hold floor is universal. Beyond that, escape difficulty is controlled by mash count — not by extending the floor. The "effective hold" column shows approximate real-world hold duration accounting for mash difficulty.

| Victim % | Suck Range | Mashes to Escape | Effective Hold Duration | Launch Speed |
|----------|-----------|-------------------|------------------------|-------------|
| 0% | Short (close range only) | 5 | ~1–1.2s | Slow (weak projectile) |
| 50% | Medium | 10 | ~1.5–2s | Medium |
| 100%+ | Long (half stage) | 15+ | ~2.5s+ | Fast (likely KO) |

### Edge Case: Simultaneous Suck

If two players suck each other at the same time, the first to connect (server tick order) wins. The other player's suck is interrupted by being captured.

## Damage & Knockback System

- Each player has a damage percentage starting at 0%, no cap
- Taking hits increases %
- Knockback formula: `baseKnockback + (damage% * knockbackScaling)`
- **Knockback direction:** determined by the attack direction (the direction the attacker is aiming). Light and heavy attacks knock opponents away from the attacker in the aimed direction. Suck projectiles knock in the direction of projectile travel.
- Death occurs when knocked past the blast zone boundary

## Controls

### Desktop — Keyboard

| Key | Function |
|-----|----------|
| A / D | Move left / right |
| W | Up directional input (for aimed attacks) |
| S | Down / crouch |
| Space | Jump / double jump |
| J | Light attack |
| K | Heavy attack |
| L | Suck (hold to inhale, press again to spit) |

### Mobile — Touch

**Left side:** Virtual joystick for movement.

**Right side:** Fan-layout action buttons anchored on the primary action.

- **Light attack** (primary, large ~88px): Bottom-right corner, always under the thumb
- **Suck** (secondary, ~58px): Left of light attack (9 o'clock fan position)
- **Jump** (secondary, ~58px): Upper-left of light attack (10–11 o'clock fan position)
- **Heavy** (secondary, ~58px): Above light attack (12 o'clock fan position)

**Directional input on buttons:**
- Tap = fires in facing direction (or neutral if in deadzone)
- Flick on/near button = fires in the flick direction, overriding facing direction
- Deadzone threshold prevents accidental directional override from sloppy taps

### Input Normalization

Both input methods produce the same input state sent to the server: `{left, right, up, down, jump, light, heavy, suck}` (booleans). The server does not know or care which device type the player is using.

## Architecture

### Overview

```
Host Machine (Node.js)
├── Colyseus Game Server
│   ├── Room Manager (create, join, room codes)
│   └── Game Room(s)
│       ├── Authoritative Game State
│       └── Physics simulation @ 60hz
│
└── WebSocket transport
    ├── Client 1 (Host — also runs Phaser client)
    ├── Client 2 (Phone)
    ├── Client 3 (Phone)
    └── Client 4 (Laptop)
```

### Authoritative Server Model

The host runs the game simulation. Clients send inputs; the server processes them and broadcasts authoritative state. On LAN, latency is 1–5ms so client-side prediction is nearly free.

**State flow:**
1. Client captures input (keyboard/touch) and sends to server each frame
2. Server processes all player inputs in the next tick
3. Server updates authoritative state (positions, velocities, %, stocks, suck states)
4. Server broadcasts state delta to all clients via Colyseus schema sync
5. Clients interpolate/snap to authoritative state and render

### Server Tick Loop (60hz)

Each tick:
1. Collect all pending inputs per player
2. Process movement (gravity, horizontal velocity, jumping)
3. Process attacks (hitbox activation, collision detection)
4. Process suck (vacuum cone, capture, mash escape, projectile launch)
5. Apply knockback, check blast zone deaths
6. Broadcast state delta

### Room Flow

1. Host opens the app → Colyseus server starts + Phaser client loads
2. Server generates a 4-character alphanumeric room code
3. Host sees code on lobby screen, shares verbally or via text
4. Other players open `http://<host-ip>:3000` → enter room code → join
5. Lobby shows connected players (up to 4) with color assignments and ready status
6. Host starts the match when at least 2 players are ready
7. Match plays → winner screen → back to lobby for rematch

### Network Messages

| Direction | Message | Payload |
|-----------|---------|---------|
| Client → Server | `input` | `{left, right, up, down, jump, light, heavy, suck}` booleans |
| Server → Clients | state sync | Colyseus auto-syncs room state schema |
| Client → Server | `ready` | Player toggles ready in lobby |
| Server → Clients | `match-start` | Countdown begins |
| Server → Clients | `player-died` | Stock lost, respawn triggered |
| Server → Clients | `match-end` | Winner ID |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Client engine | Phaser 3 |
| Server framework | Colyseus + @colyseus/schema |
| Language | TypeScript (shared types between client/server) |
| HTTP server | Express (serves client files + Colyseus transport) |
| Bundler | Vite |
| Transport | WebSocket (Colyseus built-in) |

## Project Structure

```
kirby_fighter/
├── package.json
├── tsconfig.json
├── src/
│   ├── server/
│   │   ├── index.ts              # Server entry, Express + Colyseus setup
│   │   ├── GameRoom.ts           # Room logic, tick loop, input processing
│   │   ├── state/
│   │   │   ├── GameState.ts      # Colyseus schema: players, stage, match status
│   │   │   └── PlayerState.ts    # Per-player: position, velocity, %, stocks, suck state
│   │   └── physics/
│   │       ├── movement.ts       # Gravity, horizontal movement, jumping
│   │       ├── combat.ts         # Hitbox checks, damage, knockback calculation
│   │       └── suck.ts           # Vacuum cone, capture, mash escape, projectile
│   ├── client/
│   │   ├── index.ts              # Entry, Phaser config
│   │   ├── scenes/
│   │   │   ├── LobbyScene.ts     # Room code entry, player list, ready up
│   │   │   ├── GameScene.ts      # Main gameplay, sprite rendering, state sync
│   │   │   └── ResultScene.ts    # Winner display, rematch option
│   │   ├── input/
│   │   │   ├── KeyboardInput.ts  # WASD + Space + JKL mapping
│   │   │   └── TouchInput.ts     # Virtual joystick + fan buttons
│   │   ├── sprites/
│   │   │   └── KirbySprite.ts    # Kirby rendering, animation states
│   │   └── network/
│   │       └── ClientConnection.ts  # Colyseus client, state listener
│   └── shared/
│       ├── constants.ts          # Physics values, damage tables, suck scaling
│       └── types.ts              # Input type, shared enums
├── public/
│   ├── index.html
│   └── assets/                   # Sprite sheets, sounds (later)
└── docs/
```

## Explicit Scope Boundaries (v1)

**In scope:**
- Mirror-match Kirby gameplay with 4 verbs
- Flat stage, 3-stock matches
- LAN multiplayer via room codes, up to 4 players
- Desktop keyboard + mobile touch controls
- Basic HUD (damage %, stock icons)

**Out of scope:**
- Character selection / multiple characters
- Directional attack variants (different animations per direction)
- Platforms on the stage
- Sound / music
- AI opponents
- Online / WAN multiplayer
- Spectator mode
- Replay system
