import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { VehicleClassType, VEHICLE_CLASSES, VehicleState, TakedownType } from '../types/game';
import { CarVisualRefs } from './carBuilder';

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

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -25, 0),
    });
    this.world.defaultContactMaterial.friction = 0.2;
    this.world.defaultContactMaterial.restitution = 0.3;
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

      // Invert steer because -steer is turning left (positive Y yaw)
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
    const activeVehicles = Array.from(this.vehicles.values()).filter((v) => !v.state.isDead);

    for (let i = 0; i < activeVehicles.length; i++) {
      for (let j = i + 1; j < activeVehicles.length; j++) {
        const vA = activeVehicles[i];
        const vB = activeVehicles[j];

        const distSq = vA.body.position.distanceSquared(vB.body.position);
        const radiusA = VEHICLE_CLASSES[vA.classType].length * 0.48;
        const radiusB = VEHICLE_CLASSES[vB.classType].length * 0.48;
        const collideDist = radiusA + radiusB;

        if (distSq < collideDist * collideDist) {
          const cooldownA = vA.contactCooldowns.get(vB.id) || 0;
          if (now < cooldownA) continue;

          const res = this.resolveVehicleCollision(vA, vB, now);
          if (res) {
            results.push(res);
            vA.contactCooldowns.set(vB.id, now + 350);
            vB.contactCooldowns.set(vA.id, now + 350);
          }
        }
      }
    }

    return results;
  }

  private resolveVehicleCollision(
    vA: VehiclePhysicsEntity,
    vB: VehiclePhysicsEntity,
    now: number
  ): CollisionResult | null {
    // Relative speed in km/h
    const relSpeedMs = Math.hypot(
      vA.body.velocity.x - vB.body.velocity.x,
      vA.body.velocity.z - vB.body.velocity.z
    );
    const relSpeedKmh = relSpeedMs * 3.6;

    if (relSpeedKmh < 15) {
      // Separate bodies gently if touching
      this.separateBodies(vA.body, vB.body);
      return null;
    }

    // Determine attacker vs victim
    const speedA = vA.state.speedKmh;
    const speedB = vB.state.speedKmh;

    let attacker = vA;
    let victim = vB;

    if (speedB > speedA * 1.1) {
      attacker = vB;
      victim = vA;
    }

    const attConfig = VEHICLE_CLASSES[attacker.classType];
    const vicConfig = VEHICLE_CLASSES[victim.classType];

    // Direction from attacker to victim
    const dx = victim.body.position.x - attacker.body.position.x;
    const dz = victim.body.position.z - attacker.body.position.z;
    const dist = Math.hypot(dx, dz) || 1;
    const normX = dx / dist;
    const normZ = dz / dist;

    // Impact type
    let impactType: TakedownType = 'RAM';
    const vicRightX = Math.cos(victim.state.heading);
    const vicRightZ = -Math.sin(victim.state.heading);
    const sideDot = Math.abs(normX * vicRightX + normZ * vicRightZ);

    if (sideDot > 0.55) {
      impactType = 'SIDE_SLAM';
    } else {
      impactType = 'RAM';
    }

    // Damage calculations
    const speedFactor = (relSpeedKmh - 12) / 100;
    const massFactor = attConfig.mass / vicConfig.mass;
    const boostBonus = attacker.state.isBoosting ? 1.6 : 1.0;

    let baseDmg = 28 * speedFactor * attConfig.ramPower * massFactor * boostBonus;
    baseDmg = Math.max(10, Math.min(baseDmg, 85));

    victim.state.hp = Math.max(0, victim.state.hp - Math.round(baseDmg));
    victim.state.lastHitBy = attacker.name;
    victim.state.lastHitTime = now;
    attacker.state.damageDealt += Math.round(baseDmg);

    // Attacker takes small recoil damage unless boosting
    if (!attacker.state.isBoosting) {
      const recoil = baseDmg * 0.15;
      attacker.state.hp = Math.max(0, attacker.state.hp - Math.round(recoil));
    }

    // Reward attacker with turbo boost
    attacker.state.boost = Math.min(attacker.state.maxBoost, attacker.state.boost + 30);

    // Physical bounce & push separation
    const pushStrength = Math.min(relSpeedMs * 1.2, 28) * (attacker.state.isBoosting ? 1.5 : 1.0);
    victim.body.position.x += normX * 1.5;
    victim.body.position.z += normZ * 1.5;
    victim.forwardSpeed *= -0.3; // bounce
    victim.lateralSpeed += (Math.random() > 0.5 ? 1 : -1) * pushStrength * 0.7;

    attacker.forwardSpeed *= 0.65; // speed penalty on hit
    attacker.stunTimer = 0.15;

    // Fatal takedown check
    const isDeadly = victim.state.hp <= 0;
    if (isDeadly && !victim.state.isDead) {
      victim.state.isDead = true;
      attacker.state.takedowns += 1;
      attacker.state.boost = attacker.state.maxBoost; // full refill!
    }

    const hitPosition = new THREE.Vector3(
      (vA.body.position.x + vB.body.position.x) / 2,
      1.0,
      (vA.body.position.z + vB.body.position.z) / 2
    );

    return {
      attackerId: attacker.id,
      victimId: victim.id,
      damage: Math.round(baseDmg),
      type: impactType,
      impactSpeed: Math.round(relSpeedKmh),
      hitPosition,
      isDeadly,
    };
  }

  private separateBodies(bA: CANNON.Body, bB: CANNON.Body) {
    const dx = bB.position.x - bA.position.x;
    const dz = bB.position.z - bA.position.z;
    const dist = Math.hypot(dx, dz) || 1;
    const overlap = 3.5 - dist;
    if (overlap > 0) {
      const sepX = (dx / dist) * overlap * 0.5;
      const sepZ = (dz / dist) * overlap * 0.5;
      bB.position.x += sepX;
      bB.position.z += sepZ;
      bA.position.x -= sepX;
      bA.position.z -= sepZ;
    }
  }

  public step(dt: number) {
    this.world.step(1 / 60, dt, 3);
  }
}
