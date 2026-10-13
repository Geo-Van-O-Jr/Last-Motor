import * as THREE from 'three';
import { VehiclePhysicsEntity } from './physicsEngine';
import { AIArchetype } from '../types/game';
import { CombatSystem } from './combatSystem';

interface AIBotAgent {
  entity: VehiclePhysicsEntity;
  archetype: AIArchetype;
  currentTargetId: string | null;
  retargetTimer: number;
  isReversing: boolean;
  reverseTimer: number;
  stuckTimer: number;
}

export class AIController {
  private bots: Map<string, AIBotAgent> = new Map();

  public registerBot(entity: VehiclePhysicsEntity, archetype: AIArchetype) {
    this.bots.set(entity.id, {
      entity,
      archetype,
      currentTargetId: null,
      retargetTimer: Math.random() * 2, // stagger updates
      isReversing: false,
      reverseTimer: 0,
      stuckTimer: 0,
    });
  }

  public update(dt: number, allEntities: VehiclePhysicsEntity[], arenaRadius: number, combat: CombatSystem, nextRadius = arenaRadius) {
    const aliveEntities = allEntities.filter((e) => !e.state.isDead);

    for (const [, bot] of this.bots) {
      if (bot.entity.state.isDead) continue;

      const { entity, archetype } = bot;
      const inputs = entity.inputs;

      // Unstuck Detection
      if (!bot.isReversing) {
        if (entity.state.speedKmh < 5 && Math.abs(inputs.throttle) > 0.5) {
          bot.stuckTimer += dt;
          if (bot.stuckTimer > 1.2) {
            // Engage reverse maneuver
            bot.isReversing = true;
            bot.reverseTimer = 1.3 + Math.random() * 0.5;
            bot.stuckTimer = 0;
          }
        } else {
          bot.stuckTimer = Math.max(0, bot.stuckTimer - dt);
        }
      }

      // If currently executing reverse maneuver
      if (bot.isReversing) {
        bot.reverseTimer -= dt;
        inputs.throttle = -1.0;
        inputs.steer = (Math.sin(bot.reverseTimer * 5) > 0 ? 1 : -1) * 0.85;
        inputs.drift = false;
        inputs.boost = false;

        if (bot.reverseTimer <= 0) {
          bot.isReversing = false;
        }
        continue;
      }

      // Retarget timer
      bot.retargetTimer -= dt;
      if (bot.retargetTimer <= 0 || !bot.currentTargetId || !aliveEntities.find((e) => e.id === bot.currentTargetId)) {
        bot.currentTargetId = this.pickTarget(entity, aliveEntities, archetype);
        bot.retargetTimer = 2.5 + Math.random() * 2.0;
      }

      const targetEntity = aliveEntities.find((e) => e.id === bot.currentTargetId);
      if (!targetEntity) {
        // Idle cruise towards center if no targets
        inputs.throttle = 0.6;
        inputs.steer = 0;
        continue;
      }

      const myPos = entity.body.position;
      const targetPos = targetEntity.body.position;
      const dist = Math.hypot(targetPos.x - myPos.x, targetPos.z - myPos.z);
      const targetVel = targetEntity.body.velocity;
      const leadTime = Math.min(dist / 105, 0.7);
      let destination = new THREE.Vector2(targetPos.x + targetVel.x * leadTime, targetPos.z + targetVel.z * leadTime);
      // Maintain firing distance rather than aiming for a ram.
      if (dist < 18) {
        destination.x += Math.cos(entity.state.heading) * 14;
        destination.y -= Math.sin(entity.state.heading) * 14;
      }
      const pickup = !entity.state.item ? combat.nearestPickup(entity, arenaRadius) : null;
      if (pickup) destination.set(pickup.position.x, pickup.position.z);
      const distFromCenter = Math.hypot(myPos.x, myPos.z);
      if (distFromCenter > Math.min(arenaRadius - 7, nextRadius + 5)) destination.set(0, 0);
      let desiredAngle = Math.atan2(destination.x - myPos.x, destination.y - myPos.z);

      const item = entity.state.item?.type;
      const targetAngle = Math.atan2(targetPos.x - myPos.x, targetPos.z - myPos.z);
      const aimDiff = Math.atan2(Math.sin(targetAngle - entity.state.heading), Math.cos(targetAngle - entity.state.heading));
      const pursued = aliveEntities.some(e => e !== entity && e.body.position.distanceTo(myPos) < 22 &&
        (e.body.position.x - myPos.x) * Math.sin(entity.state.heading) + (e.body.position.z - myPos.z) * Math.cos(entity.state.heading) < -3);
      if ((item === 'ROCKET' && combat.lockTarget(entity, aliveEntities)) ||
          (item === 'ENERGY' && Math.abs(aimDiff) < 0.2 && dist < 65 && combat.hasSight(entity, targetEntity)) ||
          (item === 'MINE' && pursued) ||
          (item === 'SHIELD' && (entity.state.rocketThreats > 0 || dist < 25 || entity.state.hp < entity.state.maxHp * 0.5)) ||
          (item === 'REPAIR' && entity.state.hp <= entity.state.maxHp - 25) ||
          (item === 'TURBO' && entity.state.boost < 65) || item === 'DOUBLE_AMMO') combat.activate(entity, allEntities);

      // Break a missile's turn radius by moving across its path.
      const threat = combat.shots.find(s => s.kind === 'ROCKET' && s.targetId === entity.id);
      if (threat) desiredAngle = threat.heading + (archetype === 'defensive' ? -1.2 : 1.2);
      // Look ahead against actual arena bodies, including ramps and barrels.
      const origin = new THREE.Vector3(myPos.x, 0.8, myPos.z);
      const look = 7 + entity.state.speedKmh / 12;
      const endpoint = (angle: number) => origin.clone().add(new THREE.Vector3(Math.sin(angle) * look, 0, Math.cos(angle) * look));
      if (combat.ray(origin, endpoint(entity.state.heading)).hasHit) {
        const left = entity.state.heading + 0.9;
        const right = entity.state.heading - 0.9;
        const leftHit = combat.ray(origin, endpoint(left));
        const rightHit = combat.ray(origin, endpoint(right));
        desiredAngle = !leftHit.hasHit ? left : !rightHit.hasHit ? right : leftHit.distance > rightHit.distance ? left : right;
      }

      // Current heading angle (yaw)
      let heading = entity.state.heading;

      // Normalize angle difference to [-PI, PI]
      let angleDiff = desiredAngle - heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Original physics uses negative steer for positive yaw (left).
      let steerVal = Math.max(-1, Math.min(1, -angleDiff * 2.2));

      // Throttle decision
      let throttleVal = 1.0;
      const absAngle = Math.abs(angleDiff);

      // Slow down slightly on extreme hairpins, or drift!
      let driftVal = false;
      let boostVal = false;

      if (absAngle > 1.2) {
        throttleVal = 0.6;
        if (entity.state.speedKmh > 35) {
          driftVal = true; // Initiate power slide!
        }
      } else {
        // Line of sight lined up!
        throttleVal = 1.0;

        // Boost usage:
        // Use boost if lined up well and at good distance, or when HP is aggressive
        if (absAngle < 0.35 && (pickup ? origin.distanceTo(pickup.position) > 18 : dist > 28) && dist < 65 && entity.state.boost > 20) {
          boostVal = true;
        } else if (threat && absAngle < 0.5 && entity.state.boost > 20) {
          boostVal = true;
        }
      }

      inputs.steer = steerVal;
      inputs.throttle = throttleVal;
      inputs.drift = driftVal;
      inputs.boost = boostVal;
    }
  }

  private pickTarget(
    self: VehiclePhysicsEntity,
    aliveEntities: VehiclePhysicsEntity[],
    archetype: AIArchetype
  ): string | null {
    const candidates = aliveEntities.filter((e) => e.id !== self.id);
    if (candidates.length === 0) return null;

    if (archetype === 'opportunist') {
      // Pick the lowest HP candidate
      let lowest = candidates[0];
      for (const c of candidates) {
        if (c.state.hp < lowest.state.hp) {
          lowest = c;
        }
      }
      return lowest.id;
    } else if (archetype === 'defensive') {
      // Pick the closest enemy that is within 30m, else pick someone in open field
      let closest = candidates[0];
      let minDist = Infinity;
      for (const c of candidates) {
        const d = self.body.position.distanceSquared(c.body.position);
        if (d < minDist) {
          minDist = d;
          closest = c;
        }
      }
      return closest.id;
    } else {
      // Aggressive: 65% chance nearest, 35% random (promotes bot-on-bot and player variety)
      if (Math.random() > 0.35) {
        let nearest = candidates[0];
        let minDist = Infinity;
        for (const c of candidates) {
          const d = self.body.position.distanceSquared(c.body.position);
          if (d < minDist) {
            minDist = d;
            nearest = c;
          }
        }
        return nearest.id;
      } else {
        const idx = Math.floor(Math.random() * candidates.length);
        return candidates[idx].id;
      }
    }
  }

  public clear() {
    this.bots.clear();
  }
}
