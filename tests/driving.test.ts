import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PhysicsEngine } from '../src/game/physicsEngine';
import { buildCarMesh } from '../src/game/carBuilder';
import type { VehicleClassType } from '../src/types/game';
import { scenarios, setScenario, sampleDriving } from './drivingScenarios';
const approved = JSON.parse(readFileSync(new URL('./approved-driving.json', import.meta.url), 'utf8'));
for (const classType of ['INTERCEPTOR', 'BRAWLER', 'BRUISER'] as VehicleClassType[]) {
  for (const scenario of scenarios) {
    test(`approved driving trajectory: ${classType} / ${scenario}`, () => {
      const physics = new PhysicsEngine();
      const car = physics.registerVehicle('p', 'p', true, classType, new THREE.Vector3(), 0, buildCarMesh(classType), '#fff');
      const expected = approved.samples[`${classType}:${scenario}`];
      for (let frame = 0; frame < 420; frame++) {
        setScenario(car, scenario, frame);
        physics.updateVehicleDriving(car, approved.dt);
        physics.step(approved.dt);
        if (frame % 60 === 59) {
          const actual = sampleDriving(car);
          actual.forEach((value, index) => assert.ok(Math.abs(value - expected[Math.floor(frame / 60)][index]) < 1e-8, `frame ${frame}, sample ${index}: ${value}`));
        }
      }
    });
  }
}
