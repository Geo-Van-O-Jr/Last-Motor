import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsEngine } from '../src/game/physicsEngine';
import { buildCarMesh } from '../src/game/carBuilder';
import { CombatSystem } from '../src/game/combatSystem';
import { DamageSystem } from '../src/game/damageSystem';
import { ZoneSystem } from '../src/game/zoneSystem';
import { AIController } from '../src/game/aiController';
import { readPlayerAxes } from '../src/game/playerInput';
import { ROYALE_CONFIG as CFG } from '../src/game/royaleConfig';
import type { VehicleClassType, VehicleState } from '../src/types/game';

function setup() {
  const events: unknown[] = [];
  const damage = new DamageSystem(e => events.push(e));
  const physics = new PhysicsEngine(damage);
  const scene = new THREE.Scene();
  const blockers: CANNON.Body[] = [];
  const combat = new CombatSystem(scene, damage, () => blockers, {}, () => 0);
  const car = (id: string, x = 0, z = 0, heading = 0, classType: VehicleClassType = 'BRAWLER') => physics.registerVehicle(id, id, id === 'player', classType, new THREE.Vector3(x, 0, z), heading, buildCarMesh(classType), '#fff');
  return { damage, physics, combat, car, blockers, events, scene };
}
function run(combat: CombatSystem, entities: ReturnType<ReturnType<typeof setup>['car']>[], seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) combat.update(1 / 60, entities, 85);
}
function wall(z: number) {
  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(8, 3, 0.5)) });
  body.position.set(0, 2, z);
  body.updateAABB();
  return body;
}

test('keyboard/arrows and virtual steering turn left/right relative to heading; reverse flips yaw naturally', () => {
  for (const heading of [0, Math.PI / 2, -Math.PI / 2, Math.PI - 0.2]) {
    for (const [code, direction] of [['KeyA', -1], ['ArrowLeft', -1], ['KeyD', 1], ['ArrowRight', 1]] as const) {
      for (const speed of [20, -10]) {
        const { physics, car } = setup();
        const p = car('player', 0, 0, heading);
        p.forwardSpeed = speed;
        p.inputs.steer = readPlayerAxes({ [code]: true }, { throttle: 0, steer: 0 }).steer;
        physics.updateVehicleDriving(p, 1 / 60);
        const yaw = Math.atan2(Math.sin(p.state.heading - heading), Math.cos(p.state.heading - heading));
        assert.equal(Math.sign(yaw), -direction * Math.sign(speed));
        assert.equal(p.lateralSpeed, 0, 'no strafing from steering');
      }
    }
  }
  assert.equal(readPlayerAxes({}, { steer: -1, throttle: 1 }).steer, -1);
});

test('actual car contacts: soft/grazing contact is harmless, severe impact is capped, rubbing cannot repeat damage', () => {
  for (const speed of [4, 50]) {
    const { physics, car, damage } = setup();
    const a = car('player', 0, 0);
    const b = car('bot', 0, 4.4);
    a.forwardSpeed = speed; a.state.speedKmh = speed * 3.6;
    a.body.velocity.z = speed;
    physics.step(1 / 60);
    assert.ok(physics.world.contacts.length > 0, 'actual box contact');
    const hits = physics.checkCollisions(0);
    if (speed === 4) assert.equal(hits.length, 0);
    else {
      assert.ok(hits.length > 0);
      assert.ok(hits[0].damage <= CFG.collision.maxDamage);
      const firstDamage = damage.totals.collisions;
      // Persist the same real contact equations to exercise the continuous-contact latch.
      for (let t = 0.1; t < 5; t += 0.1) physics.checkCollisions(t);
      assert.equal(damage.totals.collisions, firstDamage);
      assert.ok(Math.abs(a.forwardSpeed - speed) <= CFG.collision.maxImpulseMs + 1e-8);
      assert.ok(Math.abs(b.lateralSpeed) <= CFG.collision.maxImpulseMs);
    }
  }
});

test('cars inside old distance-radius but not physically touching receive no collision damage', () => {
  const { physics, car } = setup();
  const a = car('player', 0, 0); car('bot', 3, 0);
  a.body.velocity.z = 40;
  physics.step(1 / 60);
  assert.equal(physics.checkCollisions(0).length, 0);
});

test('fast tangential grazing contact does not treat sideways relative speed as a head-on impact', () => {
  const { physics, car } = setup();
  const a = car('player', 0, 0); car('bot', 0, 4.4);
  a.body.velocity.x = 40;
  physics.step(1 / 60);
  assert.ok(physics.world.contacts.length > 0);
  assert.equal(physics.checkCollisions(0).length, 0);
});

test('energy is a swept forward shot, hits at low frame rate, does not auto-aim and is blocked by walls', () => {
  const { combat, car, blockers } = setup();
  const p = car('player'); const victim = car('bot', 0, 15);
  combat.giveItem(p, 'ENERGY'); combat.activate(p, [p, victim]);
  combat.update(0.2, [p, victim], 85);
  assert.equal(victim.state.hp, victim.state.maxHp - CFG.energy.damage);
  victim.body.position.x = 8;
  p.state.itemCooldown = 0; combat.giveItem(p, 'ENERGY'); combat.activate(p, [p, victim]);
  run(combat, [p, victim], 1);
  assert.equal(victim.state.hp, victim.state.maxHp - CFG.energy.damage);
  victim.body.position.x = 0;
  blockers.push(wall(10));
  combat.giveItem(p, 'ENERGY'); combat.activate(p, [p, victim]);
  run(combat, [p, victim], 1);
  assert.equal(victim.state.hp, victim.state.maxHp - CFG.energy.damage);
});

test('rocket limited lock, threat warning, hit and obstacle evasion', () => {
  const { combat, car, blockers } = setup();
  const p = car('player'); const victim = car('bot', 2, 26); const far = car('far', 0, 65); const rear = car('rear', 0, -20);
  assert.equal(combat.lockTarget(p, [p, far, rear]), undefined);
  combat.giveItem(p, 'ROCKET'); combat.activate(p, [p, victim]);
  combat.update(1 / 60, [p, victim], 85);
  assert.equal(victim.state.rocketThreats, 1);
  run(combat, [p, victim], 1);
  assert.equal(victim.state.hp, victim.state.maxHp - CFG.rocket.damage);
  p.state.itemCooldown = 0;
  combat.giveItem(p, 'ROCKET'); combat.activate(p, [p, victim]);
  blockers.push(wall(12));
  run(combat, [p, victim], 1);
  assert.equal(victim.state.hp, victim.state.maxHp - CFG.rocket.damage);
  assert.equal(victim.state.rocketThreats, 0);
});

test('rocket can be evaded by a sharp crossing turn; tracking never snaps', () => {
  const { combat, car } = setup();
  const p = car('player'); const target = car('bot', 0, 30);
  combat.giveItem(p, 'ROCKET'); combat.activate(p, [p, target]);
  for (let t = 0; t < 2; t += 1 / 60) {
    target.body.position.x += 1;
    const before = combat.shots[0]?.heading;
    combat.update(1 / 60, [p, target], 85);
    if (before !== undefined && combat.shots[0]) assert.ok(Math.abs(combat.shots[0].heading - before) <= CFG.rocket.turnRate / 60 + 1e-9);
  }
  assert.equal(target.state.hp, target.state.maxHp);
});

test('mine drops behind, cannot trigger before arming, then applies area damage and expires', () => {
  const { combat, car } = setup();
  const p = car('player'); const pursuer = car('bot', 0, -4.5); const nearby = car('nearby', 4, -4.5);
  combat.giveItem(p, 'MINE'); combat.activate(p, [p, pursuer, nearby]);
  assert.ok(combat.shots[0].position.z < p.body.position.z);
  combat.update(0.3, [p, pursuer, nearby], 85);
  assert.equal(pursuer.state.hp, pursuer.state.maxHp);
  combat.update(0.45, [p, pursuer, nearby], 85);
  assert.equal(pursuer.state.hp, pursuer.state.maxHp - CFG.mine.damage);
  assert.ok(nearby.state.hp < nearby.state.maxHp);
  assert.equal(combat.shots.length, 0);
  p.state.itemCooldown = 0; combat.giveItem(p, 'MINE'); combat.activate(p, [p]);
  run(combat, [p], CFG.mine.life + 1);
  assert.equal(combat.shots.length, 0);
});

test('shield mitigates damage and expires, repair clamps, turbo only changes available reserve temporarily', () => {
  const { combat, car, damage, physics } = setup();
  const p = car('player');
  combat.giveItem(p, 'SHIELD'); combat.activate(p, [p]);
  damage.apply(p, 20, 'weapons', 0);
  assert.equal(p.state.maxHp - p.state.hp, 7);
  run(combat, [p], CFG.items.shieldSec + 0.1);
  damage.apply(p, 20, 'environment', 7);
  assert.equal(p.state.maxHp - p.state.hp, 7 + 20 * CFG.damageScale.environment);
  combat.giveItem(p, 'REPAIR'); combat.activate(p, [p]);
  assert.equal(p.state.hp, p.state.maxHp);
  run(combat, [p], 0.5);
  combat.giveItem(p, 'TURBO'); combat.activate(p, [p]);
  assert.equal(p.state.maxBoost, CFG.items.turboCapacity);
  p.inputs.throttle = 1; p.inputs.boost = true;
  physics.updateVehicleDriving(p, 1 / 60);
  assert.ok(Math.abs(p.forwardSpeed - 24 * 1.9 / 60) < 1e-9);
  run(combat, [p], CFG.items.turboSec + 0.1);
  assert.equal(p.state.maxBoost, 100); assert.ok(p.state.boost <= 100);
});

test('single slot, double ammunition, cooldown between shots and finite bonus', () => {
  const { combat, car } = setup(); const p = car('player');
  combat.giveItem(p, 'DOUBLE_AMMO'); combat.activate(p, [p]);
  run(combat, [p], 0.5);
  combat.giveItem(p, 'ENERGY');
  assert.equal(p.state.item?.ammo, 2);
  assert.equal(combat.giveItem(p, 'ROCKET'), false);
  combat.activate(p, [p]);
  assert.equal(p.state.item?.ammo, 1);
  assert.equal(combat.activate(p, [p]), false);
  run(combat, [p], 0.5);
  assert.equal(combat.activate(p, [p]), true);
  assert.equal(p.state.item, null);
  run(combat, [p], 0.5);
  combat.giveItem(p, 'DOUBLE_AMMO'); combat.activate(p, [p]);
  run(combat, [p], CFG.items.doubleAmmoSec + 0.1);
  combat.giveItem(p, 'ROCKET'); assert.equal((p.state as VehicleState).item?.ammo, 1);
});

test('distributed pickups collect while moving, respawn, and hide outside safe zone', () => {
  const { combat, car } = setup(); const p = car('player');
  combat.setupPickups(); assert.equal(combat.pickups.length, 28);
  const pickup = combat.pickups[0];
  p.body.position.set(pickup.position.x, 1, pickup.position.z);
  p.forwardSpeed = 40; combat.update(1 / 60, [p], 85);
  assert.equal(p.state.item?.type, 'ROCKET'); assert.equal(p.forwardSpeed, 40);
  assert.equal(pickup.mesh.visible, false);
  run(combat, [], CFG.items.respawnSec + 0.1);
  assert.equal(pickup.mesh.visible, true);
  combat.update(1 / 60, [], 42); assert.equal(pickup.mesh.visible, false);
  assert.ok(combat.nearestPickup(p, 42));
});

test('bots collect, target one another, fire weapons, drop defensive mines and activate shield', () => {
  const { combat, car } = setup(); const bot = car('bot'); const target = car('enemy', 0, 25);
  const ai = new AIController(); ai.registerBot(bot, 'aggressive');
  combat.setupPickups(); ai.update(0.1, [bot, target], 85, combat);
  assert.ok(bot.inputs.throttle > 0);
  combat.giveItem(bot, 'ENERGY'); ai.update(0.1, [bot, target], 85, combat);
  assert.equal(combat.shots[0]?.kind, 'ENERGY');
  run(combat, [bot, target], 0.5);
  assert.ok(target.state.hp < target.state.maxHp);
  target.body.position.z = -10;
  combat.giveItem(bot, 'MINE'); ai.update(0.1, [bot, target], 85, combat);
  assert.equal(combat.shots[0]?.kind, 'MINE');
  run(combat, [bot, target], 0.5);
  combat.giveItem(bot, 'SHIELD'); ai.update(0.1, [bot, target], 85, combat);
  assert.ok(bot.state.shieldTime > 0);
});

test('high-speed pickup collection sweeps the driven segment instead of skipping crossed pickups', () => {
  const { combat, car } = setup(); const p = car('player');
  combat.setupPickups(); const pickup = combat.pickups[0];
  p.body.position.set(pickup.position.x - 5, 1, pickup.position.z);
  combat.update(0.1, [p], 85);
  assert.equal(p.state.item, null);
  p.body.position.x += 10;
  combat.update(0.1, [p], 85);
  assert.ok(p.state.item);
});

test('zone warnings, continuous phased reductions, increasing damage and a roomy final radius', () => {
  const zone = new ZoneSystem();
  assert.deepEqual([zone.getState(0).status, zone.getState(0).secondsRemaining], ['waiting', 30]);
  assert.equal(zone.getState(30).status, 'closing');
  assert.equal(zone.getState(40).radius, 77.5);
  assert.equal(zone.getState(50).radius, 70);
  let previous = 85;
  for (let t = 0; t < 160; t += 0.1) { const radius = zone.getState(t).radius; assert.ok(radius <= previous + 1e-9); previous = radius; }
  assert.equal(zone.getState(200).status, 'final');
  assert.equal(zone.getState(200).radius, 42);
  assert.ok(zone.getState(200).damagePerSec > zone.getState(40).damagePerSec);
});

test('kill attribution, effective damage totals, dead vehicles and cleanup cannot leak damage/items', () => {
  const { damage, combat, car, events, scene } = setup(); const p = car('player'); const victim = car('bot');
  damage.apply(victim, 500, 'weapons', 0, p, 'ENERGIA');
  damage.apply(victim, 500, 'weapons', 1, p, 'ENERGIA');
  assert.equal(p.state.takedowns, 1); assert.equal(events.length, 1);
  assert.equal(damage.totals.weapons, victim.state.maxHp);
  assert.equal(victim.body.collisionResponse, false);
  combat.giveItem(p, 'MINE'); combat.activate(p, [p]); combat.setupPickups(); combat.clear();
  assert.equal(scene.children.length, 0); assert.equal(combat.shots.length, 0); assert.equal(combat.pickups.length, 0);
});
