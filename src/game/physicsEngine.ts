import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { VehicleClassType, VEHICLE_CLASSES, VehicleState, TakedownType } from '../types/game';
import { CarVisualRefs } from './carBuilder';
import { DamageSystem } from './damageSystem';
import { ROYALE_CONFIG } from './royaleConfig';

export interface VehiclePhysicsEntity {
  id: string;
  name: string;
  isPlayer: boolean;
  classType: VehicleClassType;
  body: CANNON.Body;
  visuals: CarVisualRefs;
  state: VehicleState;
  inputs: {
    throttle: number; // -1 to 1
    steer: number; // -1 to 1
    drift: boolean;
    boost: boolean;
  };
  stunTimer: number;
  contactCooldowns: Map<string, number>;
  forwardSpeed: number; // current forward velocity (m/s)
  lateralSpeed: number; // current lateral drift velocity (m/s)
}

export interface CollisionResult {
  attackerId: string;
  victimId: string;
  damage: number;
  type: TakedownType;
  impactSpeed: number;
  hitPosition: THREE.Vector3;
  isDeadly: boolean;
}

export class PhysicsEngine {
  public world: CANNON.World;
  public vehicles: Map<string, VehiclePhysicsEntity> = new Map();
  private carMaterial = new CANNON.Material('royale-cars');

  private beforeStep = new Map<number, CANNON.Vec3>();

  constructor(public damage = new DamageSystem()) {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -25, 0),
    });
    this.world.defaultContactMaterial.friction = 0.2;
    this.world.defaultContactMaterial.restitution = 0.3;
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.carMaterial, this.carMaterial, { friction: 0.15, restitution: 0.05 }));
  }

  public registerVehicle(
    id: string,
    name: string,
    isPlayer: boolean,
    classType: VehicleClassType,
    spawnPos: THREE.Vector3,
    spawnRotY: number,
    visuals: CarVisualRefs,
    color: string,
    aiBehavior?: 'aggressive' | 'opportunist' | 'defensive'
  ): VehiclePhysicsEntity {
    const config = VEHICLE_CLASSES[classType];

    // Physics body box shape
    const halfExtents = new CANNON.Vec3(config.width / 2, config.height / 2, config.length / 2);
    const boxShape = new CANNON.Box(halfExtents);

    const body = new CANNON.Body({
      mass: config.mass,
      shape: boxShape,
      linearDamping: 0.1,
      angularDamping: 0.9,
      material: this.carMaterial,
    });

    // Lock pitch and roll so cars NEVER flip upside down or glitch through floor!
    body.angularFactor.set(0, 1, 0);

    body.position.set(spawnPos.x, config.height / 2 + 0.05, spawnPos.z);
    body.quaternion.setFromEuler(0, spawnRotY, 0);

    this.world.addBody(body);

    const state: VehicleState = {
      id,
      name,
      isPlayer,
      classType,
      hp: config.armor,
      maxHp: config.armor,
      boost: 60,
      maxBoost: 100,
      isDead: false,
      takedowns: 0,
      damageDealt: 0,
      speedKmh: 0,
      isBoosting: false,
      isDrifting: false,
      driftAngle: 0,
      lastHitTime: 0,
      aiBehavior,
      color,
      position: { x: spawnPos.x, y: 0, z: spawnPos.z },
      heading: spawnRotY,
      item: null, itemCooldown: 0, itemAcquired: 0,
      shieldTime: 0, turboTime: 0, doubleAmmoTime: 0,
      rocketThreats: 0, lockTargetName: null,
    };

    const entity: VehiclePhysicsEntity = {
      id,
      name,
      isPlayer,
      classType,
      body,
      visuals,
      state,
      inputs: {
        throttle: 0,
        steer: 0,
        drift: false,
        boost: false,
      },
      stunTimer: 0,
      contactCooldowns: new Map(),
      forwardSpeed: 0,
      lateralSpeed: 0,
    };

    this.vehicles.set(id, entity);
    return entity;
  }

  public updateVehicleDriving(entity: VehiclePhysicsEntity, dt: number) {
    if (entity.state.isDead) return;

    const { body, inputs, classType, state } = entity;
    const config = VEHICLE_CLASSES[classType];

    // Reduce stun timer from impacts
    if (entity.stunTimer > 0) {
      entity.stunTimer = Math.max(0, entity.stunTimer - dt);
    }

    // Boost logic
    let isBoostingNow = false;
    if (inputs.boost && state.boost > 5 && inputs.throttle > 0) {
      isBoostingNow = true;
      state.boost = Math.max(0, state.boost - dt * 28);
    }
    state.isBoosting = isBoostingNow;

    // Drift logic
    const currentSpeedKmh = Math.abs(entity.forwardSpeed) * 3.6;
    const isDriftingNow = inputs.drift && currentSpeedKmh > 20 && Math.abs(inputs.steer) > 0.15;
    state.isDrifting = isDriftingNow;

    if (isDriftingNow) {
      state.boost = Math.min(state.maxBoost, state.boost + dt * 18);
      state.driftAngle = THREE.MathUtils.lerp(state.driftAngle, -inputs.steer * 0.4, dt * 8);
    } else {
      state.driftAngle = THREE.MathUtils.lerp(state.driftAngle, 0, dt * 10);
    }

    // Steering calculation
    if (Math.abs(inputs.steer) > 0.05) {
      // Speed factor allows turning even when moving slowly, but stabilizes at high speed
      const speedFactor = Math.min(Math.abs(entity.forwardSpeed) / 12, 1.0);
      const effectiveHandling = config.handling * (isDriftingNow ? 1.4 : 1.0);
      const turnRate = effectiveHandling * (0.35 + 0.65 * speedFactor);
      const dirSign = entity.forwardSpeed >= -0.5 ? 1 : -1;

      // Negative input produces positive Y yaw (left); reverse flips naturally.
      state.heading += -inputs.steer * turnRate * dt * dirSign;
    }

    // Keep heading normalized in [-PI, PI]
    while (state.heading > Math.PI) state.heading -= Math.PI * 2;
    while (state.heading < -Math.PI) state.heading += Math.PI * 2;

    // Apply clean rotation to physics body
    body.quaternion.setFromEuler(0, state.heading, 0);
    body.angularVelocity.set(0, 0, 0);

    // Forward and Right direction vectors
    const fX = Math.sin(state.heading);
    const fZ = Math.cos(state.heading);
    const rX = Math.cos(state.heading);
    const rZ = -Math.sin(state.heading);

    // Throttle & Acceleration
    const maxSpeedMs = (config.maxSpeed * (isBoostingNow ? 1.35 : 1.0)) / 3.6;
    const accelRate = config.acceleration * (isBoostingNow ? 1.9 : 1.0);

    if (inputs.throttle > 0) {
      if (entity.forwardSpeed < maxSpeedMs) {
        entity.forwardSpeed += accelRate * inputs.throttle * dt;
      } else {
        // Natural decay to top speed
        entity.forwardSpeed = THREE.MathUtils.lerp(entity.forwardSpeed, maxSpeedMs, dt * 2);
      }
    } else if (inputs.throttle < 0) {
      if (entity.forwardSpeed > 1) {
        // Braking
        entity.forwardSpeed -= 38 * dt;
      } else if (entity.forwardSpeed > -16) {
        // Reverse
        entity.forwardSpeed -= 15 * dt;
      }
    } else {
      // Coasting drag
      entity.forwardSpeed = THREE.MathUtils.lerp(entity.forwardSpeed, 0, dt * 1.8);
    }

    // Lateral drift slip
    if (isDriftingNow) {
      const targetSlip = -inputs.steer * 9.0;
      entity.lateralSpeed = THREE.MathUtils.lerp(entity.lateralSpeed, targetSlip, dt * 4);
    } else {
      entity.lateralSpeed = THREE.MathUtils.lerp(entity.lateralSpeed, 0, dt * 18);
    }

    // Combine forward speed and lateral drift into body velocity
    body.velocity.x = fX * entity.forwardSpeed + rX * entity.lateralSpeed;
    body.velocity.z = fZ * entity.forwardSpeed + rZ * entity.lateralSpeed;

    // Ground clamping: ensure car stays firmly on asphalt
    const groundY = config.height / 2;
    if (body.position.y < groundY + 0.05) {
      body.position.y = groundY + 0.02;
      if (body.velocity.y < 0) body.velocity.y = 0;
    }

    // Update speed readout in km/h
    state.speedKmh = Math.round(Math.abs(entity.forwardSpeed) * 3.6);

    // Synchronize 3D Mesh with physics
    state.position.x = body.position.x;
    state.position.y = body.position.y - groundY;
    state.position.z = body.position.z;

    // Position mesh so tires touch ground at y = 0
    entity.visuals.group.position.set(body.position.x, body.position.y - groundY, body.position.z);
    entity.visuals.group.quaternion.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w
    );

    // Front wheels steering angle
    const steerAngle = -inputs.steer * 0.45;
    entity.visuals.frontLeftWheel.rotation.y = steerAngle;
    entity.visuals.frontRightWheel.rotation.y = steerAngle;

    // Wheel rolling rotation
    const rollDelta = (entity.forwardSpeed / 0.42) * dt;
    entity.visuals.wheelMeshes.forEach((w) => {
      w.rotation.x += rollDelta;
    });
  }

  public checkCollisions(now: number): CollisionResult[] {
    const results: CollisionResult[] = [];
    const byBody = new Map(Array.from(this.vehicles.values()).map(v => [v.body.id, v]));
    const seen = new Set<string>();
    for (const contact of this.world.contacts) {
      const a = byBody.get(contact.bi.id);
      const b = byBody.get(contact.bj.id);
      if (!a || !b || a.state.isDead || b.state.isDead) continue;
      const key = [a.id, b.id].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      const rearmAt = a.contactCooldowns.get(b.id) ?? -Infinity;
      // Continuous contact extends the lockout, so rubbing cannot farm damage.
      a.contactCooldowns.set(b.id, now + ROYALE_CONFIG.collision.cooldownSec);
      b.contactCooldowns.set(a.id, now + ROYALE_CONFIG.collision.cooldownSec);
      if (now < rearmAt) continue;

      const va = this.beforeStep.get(a.body.id) ?? a.body.velocity;
      const vb = this.beforeStep.get(b.body.id) ?? b.body.velocity;
      const closing = Math.max(0, va.vsub(vb).dot(contact.ni));
      const kmh = closing * 3.6;
      // Physical response is handled by Cannon. Transfer only a bounded change
      // into the arcade velocity memory, without teleports or random impulses.
      for (const car of [a, b]) {
        const heading = car.state.heading;
        const projectedForward = car.body.velocity.x * Math.sin(heading) + car.body.velocity.z * Math.cos(heading);
        const projectedSide = car.body.velocity.x * Math.cos(heading) - car.body.velocity.z * Math.sin(heading);
        const cap = ROYALE_CONFIG.collision.maxImpulseMs;
        car.forwardSpeed += THREE.MathUtils.clamp(projectedForward - car.forwardSpeed, -cap, cap);
        car.lateralSpeed += THREE.MathUtils.clamp(projectedSide - car.lateralSpeed, -cap, cap);
      }
      if (kmh < ROYALE_CONFIG.collision.harmlessBelowKmh) continue;
      const attacker = a.state.speedKmh >= b.state.speedKmh ? a : b;
      const victim = attacker === a ? b : a;
      const rawDamage = Math.min(ROYALE_CONFIG.collision.maxDamage, (kmh - ROYALE_CONFIG.collision.harmlessBelowKmh) * 0.09);
      const amount = this.damage.apply(victim, rawDamage, 'collisions', now, attacker, 'COLISÃO');
      results.push({ attackerId: attacker.id, victimId: victim.id, damage: amount,
        type: 'RAM', impactSpeed: kmh, isDeadly: victim.state.isDead,
        hitPosition: new THREE.Vector3((a.body.position.x + b.body.position.x) / 2, 1, (a.body.position.z + b.body.position.z) / 2) });
    }
    return results;
  }

  public step(dt: number) {
    this.beforeStep.clear();
    this.vehicles.forEach(v => this.beforeStep.set(v.body.id, v.body.velocity.clone()));
    this.world.step(1 / 60, dt, 3);
  }
}
