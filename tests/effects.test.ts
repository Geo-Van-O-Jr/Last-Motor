import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EffectsManager } from '../src/game/effectsManager';

test('particle expiry releases cloned materials while keeping shared geometry valid until engine destruction', () => {
  const scene = new THREE.Scene();
  const effects = new EffectsManager(scene);
  effects.emitSparks(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 1);
  const spark = scene.children[0] as THREE.Mesh;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  spark.geometry.addEventListener('dispose', () => geometryDisposals++);
  (spark.material as THREE.Material).addEventListener('dispose', () => materialDisposals++);
  effects.update(5);
  assert.equal(scene.children.length, 0);
  assert.equal(materialDisposals, 1);
  assert.equal(geometryDisposals, 0);
  effects.emitSparks(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 1);
  assert.equal((scene.children[0] as THREE.Mesh).geometry, spark.geometry);
  effects.clearAll();
  assert.equal(geometryDisposals, 0);
  effects.destroy();
  assert.equal(geometryDisposals, 1);
});
