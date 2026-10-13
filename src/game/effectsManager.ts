import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh | THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  shrink: boolean;
  color?: THREE.Color;
}

export class EffectsManager {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private skidmarks: THREE.Mesh[] = [];

  // Reusable materials & geometries for high performance
  private sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });

  private smokeGeo = new THREE.DodecahedronGeometry(0.4, 0);
  private smokeMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    transparent: true,
    opacity: 0.6,
    roughness: 1.0,
  });

  private fireGeo = new THREE.DodecahedronGeometry(0.5, 0);
  private fireMat = new THREE.MeshStandardMaterial({
    color: 0xff5500,
    emissive: 0xff2200,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.8,
  });

  private nitroGeo = new THREE.ConeGeometry(0.2, 0.9, 6);
  private nitroMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.9,
  });

  private debrisGeo = new THREE.BoxGeometry(0.4, 0.25, 0.5);
  private debrisMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.4,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public emitSparks(pos: THREE.Vector3, normal: THREE.Vector3, count: number = 12) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone());
      mesh.position.copy(pos);

      const spread = new THREE.Vector3(
        normal.x + (Math.random() - 0.5) * 1.5,
        Math.abs(normal.y) + Math.random() * 1.5 + 0.5,
        normal.z + (Math.random() - 0.5) * 1.5
      ).normalize().multiplyScalar(6 + Math.random() * 12);

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: spread,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        size: 0.15,
        shrink: true,
      });
    }
  }

  public emitDriftSmoke(pos: THREE.Vector3, intensity: number = 1) {
    const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
    mesh.position.copy(pos);
    mesh.position.y += 0.2;
    mesh.scale.setScalar(0.4 * intensity);

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.2,
      0.8 + Math.random() * 0.8,
      (Math.random() - 0.5) * 1.2
    );

    this.scene.add(mesh);
    this.particles.push({
      mesh,
      velocity,
      life: 0.5,
      maxLife: 0.5,
      size: 0.4 * intensity,
      shrink: false,
    });
  }

  public emitDamageSmoke(pos: THREE.Vector3, isCritical: boolean) {
    const geo = isCritical && Math.random() > 0.4 ? this.fireGeo : this.smokeGeo;
    const mat = (isCritical && Math.random() > 0.4 ? this.fireMat : this.smokeMat).clone();
    if (!isCritical) {
      mat.color.setHex(0x555555); // darker smoke
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.x += (Math.random() - 0.5) * 0.4;
    mesh.position.z += (Math.random() - 0.5) * 0.4;

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      1.5 + Math.random() * 1.5,
      (Math.random() - 0.5) * 0.8
    );

    this.scene.add(mesh);
    this.particles.push({
      mesh,
      velocity,
      life: 0.6,
      maxLife: 0.6,
      size: 0.5,
      shrink: false,
    });
  }

  public emitNitroFlame(pos: THREE.Vector3, carHeading: number) {
    const mesh = new THREE.Mesh(this.nitroGeo, this.nitroMat.clone());
    mesh.position.copy(pos);
    mesh.rotation.y = carHeading;
    mesh.rotation.x = Math.PI / 2;

    const backDir = new THREE.Vector3(
      -Math.sin(carHeading),
      0,
      -Math.cos(carHeading)
    ).multiplyScalar(5);

    this.scene.add(mesh);
    this.particles.push({
      mesh,
      velocity: backDir,
      life: 0.12,
      maxLife: 0.12,
      size: 0.8,
      shrink: true,
    });
  }

  public emitExplosion(pos: THREE.Vector3, isBig: boolean = true) {
    const count = isBig ? 35 : 20;

    // Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos);
    ring.position.y += 0.15;
    this.scene.add(ring);
    this.particles.push({
      mesh: ring,
      velocity: new THREE.Vector3(0, 0.1, 0),
      life: 0.45,
      maxLife: 0.45,
      size: 1.0,
      shrink: false,
    });

    // Fire & Smoke explosion puffs
    for (let i = 0; i < count; i++) {
      const isFire = Math.random() > 0.35;
      const geo = isFire ? this.fireGeo : this.smokeGeo;
      const mat = (isFire ? this.fireMat : this.smokeMat).clone();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        Math.random() * 14 + 3,
        (Math.random() - 0.5) * 18
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: vel,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        size: 0.8 + Math.random() * 1.2,
        shrink: true,
      });
    }

    // Flying car debris chunks
    const debrisCount = isBig ? 12 : 6;
    for (let i = 0; i < debrisCount; i++) {
      const mesh = new THREE.Mesh(this.debrisGeo, this.debrisMat.clone());
      mesh.position.copy(pos);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        8 + Math.random() * 14,
        (Math.random() - 0.5) * 22
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: vel,
        life: 1.5,
        maxLife: 1.5,
        size: 0.6,
        shrink: false,
      });
    }
  }

  public addSkidmark(pos: THREE.Vector3, heading: number) {
    if (this.skidmarks.length > 150) {
      const oldest = this.skidmarks.shift();
      if (oldest) {
        this.scene.remove(oldest);
        oldest.geometry.dispose();
      }
    }

    const skidGeo = new THREE.PlaneGeometry(0.35, 1.2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const mark = new THREE.Mesh(skidGeo, skidMat);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = -heading;
    mark.position.set(pos.x, 0.03, pos.z);

    this.scene.add(mark);
    this.skidmarks.push(mark);
  }

  public update(dt: number) {
    const gravity = new THREE.Vector3(0, -18, 0);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.velocity.addScaledVector(gravity, dt * 0.4);
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Bounce on ground if it's debris
      if (p.mesh.position.y < 0.1 && p.velocity.y < 0) {
        p.mesh.position.y = 0.1;
        p.velocity.y = -p.velocity.y * 0.4;
        p.velocity.x *= 0.7;
        p.velocity.z *= 0.7;
      }

      const progress = p.life / p.maxLife;

      // Expand & fade
      if (p.mesh instanceof THREE.Mesh && p.mesh.material instanceof THREE.Material) {
        const mat = p.mesh.material as THREE.MeshStandardMaterial;
        if (mat.transparent) {
          mat.opacity = progress * 0.8;
        }
      }

      // Shrink or grow
      if (p.shrink) {
        const s = p.size * progress;
        p.mesh.scale.set(s, s, s);
      } else {
        const s = p.size * (1 + (1 - progress) * 1.5);
        p.mesh.scale.set(s, s, s);
      }
    }
  }

  public clearAll() {
    this.particles.forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    });
    this.particles = [];

    this.skidmarks.forEach((sm) => {
      this.scene.remove(sm);
      sm.geometry.dispose();
    });
    this.skidmarks = [];
  }
}
