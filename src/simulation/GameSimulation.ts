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
  private hitThisAttack: Set<string> = new Set();

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
    if (this.fighters.length >= 2) {
      this.fighters[0].facingRight = true;
      this.fighters[1].facingRight = false;
    }
  }

  step(inputs: InputState[]): void {
    if (this.matchPhase !== MatchPhase.Playing) return;
    this.frameNumber++;

    while (inputs.length < this.fighters.length) {
      inputs.push(NULL_INPUT);
    }

    for (let i = 0; i < this.fighters.length; i++) {
      const fighter = this.fighters[i];
      const input = inputs[i];
      if (fighter.action === FighterAction.Dead) continue;

      if (fighter.invincibleFrames > 0) {
        fighter.invincibleFrames--;
      }

      this.processSuckForFighter(i, input, inputs);

      if (fighter.action !== FighterAction.CaptureHold &&
          fighter.action !== FighterAction.Inhale &&
          fighter.action !== FighterAction.Projectile) {
        processAttack(fighter, input);
      }

      processJump(fighter, input, this.stage);

      if (fighter.suck.capturedBy < 0 && fighter.action !== FighterAction.Projectile) {
        applyGravity(fighter);
      }

      if (fighter.suck.capturedBy < 0 && fighter.action !== FighterAction.Projectile) {
        processMovement(fighter, input, this.stage);
      }

      tickProjectile(fighter);
      tickAttack(fighter);
      fighter.tickActionFrame();
      tickHitstun(fighter);

      fighter.prevJumpPressed = input.jump;
      fighter.prevLightPressed = input.light;
      fighter.prevHeavyPressed = input.heavy;
      fighter.prevSuckPressed = input.suck;
    }

    this.resolveAttackHits(inputs);
    this.resolveProjectileHits();
    this.checkBlastZones();
    this.checkWinCondition();
  }

  private processSuckForFighter(index: number, input: InputState, allInputs: InputState[]): void {
    const fighter = this.fighters[index];
    const suckJustPressed = input.suck && !fighter.prevSuckPressed;

    if (fighter.action === FighterAction.Inhale) {
      if (!input.suck) {
        fighter.setAction(fighter.velocityY !== 0 ? FighterAction.Airborne : FighterAction.Idle);
        return;
      }
      const captureTarget = processInhale(fighter, this.fighters, index);
      if (captureTarget >= 0) {
        startCapture(fighter, this.fighters[captureTarget], captureTarget, index);
      }
      return;
    }

    if (fighter.action === FighterAction.CaptureHold && fighter.suck.capturedFighter >= 0) {
      const victim = this.fighters[fighter.suck.capturedFighter];
      const victimIdx = fighter.suck.capturedFighter;
      const victimInput = victimIdx < allInputs.length ? allInputs[victimIdx] : NULL_INPUT;

      if (suckJustPressed) {
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
        if (phase === null) {
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
        if (this.hitThisAttack.has(hitKey)) continue;

        const defender = this.fighters[defenderIdx];
        if (defender.action === FighterAction.Dead) continue;
        if (defender.invincibleFrames > 0) continue;
        if (defender.suck.capturedBy >= 0) continue;

        const hurtbox = getHurtbox(defender);
        if (checkHitboxOverlap(hitbox, hurtbox)) {
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
          break;
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
