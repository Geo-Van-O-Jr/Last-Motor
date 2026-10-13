import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { ItemType, WeaponType } from '../types/game';
import type { VehiclePhysicsEntity } from './physicsEngine';
import { DamageSystem } from './damageSystem';
import { ITEM_INFO, ROYALE_CONFIG as CFG } from './royaleConfig';

export interface Pickup { position: THREE.Vector3; readyAt: number; mesh: THREE.Group }
export interface Shot {
  kind: WeaponType; owner: VehiclePhysicsEntity; position: THREE.Vector3;
  heading: number; targetId: string | null; age: number; mesh: THREE.Group;
}
export interface CombatEffects {
  shot?: (kind: WeaponType, position: THREE.Vector3) => void;
  explosion?: (position: THREE.Vector3, kind: WeaponType) => void;
  pickup?: (vehicle: VehiclePhysicsEntity, type: ItemType) => void;
}

export class CombatSystem {
  public pickups: Pickup[] = [];
  public shots: Shot[] = [];
  public time = 0;
  private group = new THREE.Group();
  private shields = new Map<string, THREE.Mesh>();
  private previousPositions = new Map<string, THREE.Vector3>();
  constructor(private scene: THREE.Scene, private damage: DamageSystem, private blockers: () => CANNON.Body[], private effects: CombatEffects = {}, private random = Math.random) {
    this.group.name = 'MotorRoyaleCombat';
    scene.add(this.group);
  }

  public ray(from: THREE.Vector3, to: THREE.Vector3, bodies = this.blockers()) {
    const ray = new CANNON.Ray(new CANNON.Vec3(from.x, from.y, from.z), new CANNON.Vec3(to.x, to.y, to.z));
    ray.mode = CANNON.Ray.CLOSEST;
    const result = new CANNON.RaycastResult();
    ray.intersectBodies(bodies, result);
    return result;
  }

  public hasSight(a: VehiclePhysicsEntity, b: VehiclePhysicsEntity) {
    return !this.ray(this.carPosition(a), this.carPosition(b)).hasHit;
  }

  private carPosition(car: VehiclePhysicsEntity) { return new THREE.Vector3(car.body.position.x, 0.8, car.body.position.z); }

  public setupPickups() {
    for (const [radius, count] of [[64, 10], [43, 8], [24, 6], [12, 4]]) {
      for (let i = 0; i < count; i++) {
        // Try nearby angles to keep collection points clear of ramps/walls/barrels.
        for (let attempt = 0; attempt < 12; attempt++) {
          const angle = (i / count) * Math.PI * 2 + 0.2 + attempt * 0.045;
          const pos = new THREE.Vector3(Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius);
          const obstructed = this.blockers().some(b => {
            if (b.shapes.some(s => s instanceof CANNON.Plane)) return false;
            b.updateAABB();
            return pos.x > b.aabb.lowerBound.x - 3 && pos.x < b.aabb.upperBound.x + 3 && pos.z > b.aabb.lowerBound.z - 3 && pos.z < b.aabb.upperBound.z + 3;
          });
          if (obstructed) continue;
          const mesh = new THREE.Group();
          const cube = new THREE.Mesh(new THREE.OctahedronGeometry(1.05), new THREE.MeshStandardMaterial({ color: '#facc15', emissive: '#f59e0b', emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.2 }));
          mesh.add(cube);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: '#22d3ee' }));
          ring.rotation.x = Math.PI / 2;
          mesh.add(ring);
          mesh.position.copy(pos);
          this.group.add(mesh);
          this.pickups.push({ position: pos, readyAt: 0, mesh });
          break;
        }
      }
    }
  }

  public nearestPickup(car: VehiclePhysicsEntity, safeRadius: number) {
    return this.pickups.filter(p => p.readyAt <= this.time && Math.hypot(p.position.x, p.position.z) < safeRadius - 3)
      .sort((a, b) => this.carPosition(car).distanceToSquared(a.position) - this.carPosition(car).distanceToSquared(b.position))[0];
  }

  public giveItem(car: VehiclePhysicsEntity, type: ItemType) {
    if (car.state.isDead || car.state.item) return false;
    const weapon = type === 'ROCKET' || type === 'MINE' || type === 'ENERGY';
    const ammo = weapon && car.state.doubleAmmoTime > 0 ? 2 : 1;
    if (weapon) car.state.doubleAmmoTime = 0;
    car.state.item = { type, ammo };
    car.state.itemAcquired++;
    this.effects.pickup?.(car, type);
    return true;
  }

  private randomItem(): ItemType {
    const entries = Object.entries(CFG.pickupWeights) as [ItemType, number][];
    let roll = this.random() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [type, weight] of entries) { roll -= weight; if (roll < 0) return type; }
    return 'ENERGY';
  }

  public lockTarget(car: VehiclePhysicsEntity, entities: VehiclePhysicsEntity[]) {
    return entities.filter(e => {
      if (e === car || e.state.isDead) return false;
      const dx = e.body.position.x - car.body.position.x;
      const dz = e.body.position.z - car.body.position.z;
      const diff = Math.atan2(Math.sin(Math.atan2(dx, dz) - car.state.heading), Math.cos(Math.atan2(dx, dz) - car.state.heading));
      return Math.hypot(dx, dz) <= CFG.rocket.lockRange && Math.abs(diff) <= CFG.rocket.lockCone && this.hasSight(car, e);
    }).sort((a, b) => car.body.position.distanceSquared(a.body.position) - car.body.position.distanceSquared(b.body.position))[0];
  }

  public activate(car: VehiclePhysicsEntity, entities: VehiclePhysicsEntity[]) {
    const item = car.state.item;
    if (car.state.isDead || !item || car.state.itemCooldown > 0) return false;
    const type = item.type;
    if (type === 'SHIELD') car.state.shieldTime = CFG.items.shieldSec;
    else if (type === 'REPAIR') car.state.hp = Math.min(car.state.maxHp, car.state.hp + CFG.items.repair);
    else if (type === 'TURBO') {
      car.state.turboTime = CFG.items.turboSec;
      car.state.maxBoost = CFG.items.turboCapacity;
      car.state.boost = CFG.items.turboCapacity;
    } else if (type === 'DOUBLE_AMMO') car.state.doubleAmmoTime = CFG.items.doubleAmmoSec;
    else {
      const heading = car.state.heading;
      const offset = type === 'MINE' ? -4.5 : 3.5;
      const position = this.carPosition(car).add(new THREE.Vector3(Math.sin(heading) * offset, type === 'MINE' ? -0.55 : 0, Math.cos(heading) * offset));
      // Check the launch segment too; a muzzle against a wall must not fire through it.
      const launchHit = this.ray(this.carPosition(car), position);
      if (launchHit.hasHit) position.set(launchHit.hitPointWorld.x, position.y, launchHit.hitPointWorld.z);
      const mesh = new THREE.Group();
      const geometry = type === 'ROCKET' ? new THREE.ConeGeometry(0.3, 1.4, 8) : type === 'MINE' ? new THREE.CylinderGeometry(0.8, 0.8, 0.3, 12) : new THREE.IcosahedronGeometry(0.4);
      const shell = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: ITEM_INFO[type].color }));
      if (type === 'ROCKET') shell.rotation.x = Math.PI / 2;
      mesh.add(shell);
      if (type !== 'ENERGY') {
        const glow = new THREE.Mesh(new THREE.TorusGeometry(type === 'MINE' ? 1.1 : 0.45, 0.08, 6, 16), new THREE.MeshBasicMaterial({ color: type === 'MINE' ? '#facc15' : '#fff7ed' }));
        glow.rotation.x = Math.PI / 2;
        mesh.add(glow);
      }
      mesh.position.copy(position);
      mesh.rotation.y = heading;
      this.group.add(mesh);
      const shot: Shot = { kind: type, owner: car, position, heading, targetId: type === 'ROCKET' ? this.lockTarget(car, entities)?.id ?? null : null, age: 0, mesh };
      if (launchHit.hasHit) { this.effects.explosion?.(position, type); this.disposeMesh(mesh); }
      else this.shots.push(shot);
      this.effects.shot?.(type, position);
    }
    car.state.itemCooldown = CFG.items.cooldownSec;
    item.ammo--;
    if (item.ammo <= 0) car.state.item = null;
    return true;
  }

  public update(dt: number, entities: VehiclePhysicsEntity[], safeRadius: number) {
    this.time += dt;
    for (const car of entities) {
      for (const key of ['shieldTime', 'turboTime', 'doubleAmmoTime', 'itemCooldown'] as const) car.state[key] = Math.max(0, car.state[key] - dt);
      if (car.state.turboTime <= 0 && car.state.maxBoost !== 100) {
        car.state.maxBoost = 100;
        car.state.boost = Math.min(100, car.state.boost);
      }
      car.state.rocketThreats = 0;
      car.state.lockTargetName = car.state.item?.type === 'ROCKET' ? this.lockTarget(car, entities)?.name ?? null : null;
      let shield = this.shields.get(car.id);
      if (car.state.shieldTime > 0 && !shield) {
        shield = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshBasicMaterial({ color: '#818cf8', wireframe: true, transparent: true, opacity: 0.3 }));
        this.shields.set(car.id, shield);
        this.group.add(shield);
      }
      if (shield) { shield.visible = car.state.shieldTime > 0 && !car.state.isDead; shield.position.copy(this.carPosition(car)); }
    }
    for (const pickup of this.pickups) {
      pickup.mesh.visible = pickup.readyAt <= this.time && Math.hypot(pickup.position.x, pickup.position.z) < safeRadius - 3;
      if (!pickup.mesh.visible) continue;
      pickup.mesh.rotation.y += dt * 1.8;
      pickup.mesh.position.y = 1.5 + Math.sin(this.time * 3 + pickup.position.x) * 0.25;
      for (const car of entities) {
        if (car.state.isDead || car.state.item) continue;
        const end = this.carPosition(car).setY(0);
        const start = this.previousPositions.get(car.id) ?? end;
        const segment = new THREE.Line3(start, end);
        const nearest = segment.closestPointToPoint(pickup.position.clone().setY(0), true, new THREE.Vector3());
        if (nearest.distanceTo(pickup.position.clone().setY(0)) < 3) {
          this.giveItem(car, this.randomItem());
          pickup.readyAt = this.time + CFG.items.respawnSec;
          pickup.mesh.visible = false;
          break;
        }
      }
    }
    for (const car of entities) this.previousPositions.set(car.id, this.carPosition(car).setY(0));
    const survivors: Shot[] = [];
    for (const shot of this.shots) {
      shot.age += dt;
      let remove = false;
      if (shot.kind === 'MINE') {
        shot.mesh.children[1].visible = shot.age >= CFG.mine.armSec;
        if (shot.age >= CFG.mine.armSec && entities.some(e => !e.state.isDead && e !== shot.owner && this.carPosition(e).distanceTo(shot.position) < CFG.mine.triggerRadius)) {
          for (const car of entities) {
            const distance = this.carPosition(car).distanceTo(shot.position);
            if (distance < CFG.mine.blastRadius && !this.ray(shot.position.clone().setY(0.8), this.carPosition(car)).hasHit) {
              const factor = distance <= CFG.mine.triggerRadius ? 1 : (CFG.mine.blastRadius - distance) / (CFG.mine.blastRadius - CFG.mine.triggerRadius);
              this.damage.apply(car, CFG.mine.damage * factor, 'weapons', this.time, shot.owner, 'MINA');
            }
          }
          this.effects.explosion?.(shot.position, shot.kind);
          remove = true;
        }
        remove ||= shot.age > CFG.mine.life;
      } else {
        const target = entities.find(e => e.id === shot.targetId && !e.state.isDead);
        if (target) {
          const targetPos = this.carPosition(target);
          const desired = Math.atan2(targetPos.x - shot.position.x, targetPos.z - shot.position.z);
          const diff = Math.atan2(Math.sin(desired - shot.heading), Math.cos(desired - shot.heading));
          if (targetPos.distanceTo(shot.position) > 65 || Math.abs(diff) > 1.5 || this.ray(shot.position, targetPos).hasHit) shot.targetId = null;
          else {
            shot.heading += THREE.MathUtils.clamp(diff, -CFG.rocket.turnRate * dt, CFG.rocket.turnRate * dt);
            target.state.rocketThreats++;
          }
        } else shot.targetId = null;
        const speed = shot.kind === 'ROCKET' ? CFG.rocket.speed : CFG.energy.speed;
        const next = shot.position.clone().add(new THREE.Vector3(Math.sin(shot.heading) * speed * dt, 0, Math.cos(shot.heading) * speed * dt));
        const candidates = entities.filter(e => e !== shot.owner && !e.state.isDead);
        const result = this.ray(shot.position, next, [...this.blockers(), ...candidates.map(e => e.body)]);
        if (result.hasHit) {
          shot.position.set(result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z);
          const victim = candidates.find(e => e.body === result.body);
          if (victim) this.damage.apply(victim, shot.kind === 'ROCKET' ? CFG.rocket.damage : CFG.energy.damage, 'weapons', this.time, shot.owner, shot.kind === 'ROCKET' ? 'FOGUETE' : 'ENERGIA');
          this.effects.explosion?.(shot.position, shot.kind);
          remove = true;
        } else shot.position.copy(next);
        remove ||= shot.age > (shot.kind === 'ROCKET' ? CFG.rocket.life : CFG.energy.life);
      }
      if (remove) this.disposeMesh(shot.mesh);
      else { shot.mesh.position.copy(shot.position); shot.mesh.rotation.y = shot.heading; survivors.push(shot); }
    }
    this.shots = survivors;
  }

  private disposeMesh(object: THREE.Object3D) {
    object.removeFromParent();
    object.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(m => m.dispose()); } });
  }
  public clear() {
    [...this.group.children].forEach(child => this.disposeMesh(child));
    this.group.removeFromParent();
    this.pickups = []; this.shots = []; this.shields.clear(); this.previousPositions.clear(); this.time = 0;
  }
}
