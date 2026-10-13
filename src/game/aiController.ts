import * as THREE from 'three';
import { VehiclePhysicsEntity } from './physicsEngine';
import { AIArchetype } from '../types/game';

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

  public update(dt: number, allEntities: VehiclePhysicsEntity[], arenaRadius: number) {
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

      // Calculate path to target
      const myPos = entity.body.position;
      const targetPos = targetEntity.body.position;

      // Target prediction based on target velocity
      const targetVel = targetEntity.body.velocity;
      const dist = Math.hypot(targetPos.x - myPos.x, targetPos.z - myPos.z);
      const leadTime = Math.min(dist / 25, 1.2); // lead target
      const predictedTarget = new THREE.Vector2(
        targetPos.x + targetVel.x * leadTime,
        targetPos.z + targetVel.z * leadTime
      );

      // Desired angle towards predicted target
      const dx = predictedTarget.x - myPos.x;
      const dz = predictedTarget.y - myPos.z;
      const desiredAngle = Math.atan2(dx, dz); // 0 is along Z axis

      // Current heading angle (yaw)
      let heading = entity.state.heading;

      // Normalize angle difference to [-PI, PI]
      let angleDiff = desiredAngle - heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Wall avoidance: check distance from arena perimeter
      const distFromCenter = Math.hypot(myPos.x, myPos.z);
      if (distFromCenter > arenaRadius - 14) {
        // Steer hard back towards arena center (0, 0)
        const centerAngle = Math.atan2(-myPos.x, -myPos.z);
        let centerDiff = centerAngle - heading;
        while (centerDiff > Math.PI) centerDiff -= Math.PI * 2;
        while (centerDiff < -Math.PI) centerDiff += Math.PI * 2;
        angleDiff = centerDiff;
      }

      // Steer input mapping: negative steer turns right, positive turns left
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
        if (absAngle < 0.35 && dist > 15 && dist < 50 && entity.state.boost > 20) {
          boostVal = true;
        } else if (archetype === 'aggressive' && absAngle < 0.5 && dist < 40 && entity.state.boost > 30) {
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
