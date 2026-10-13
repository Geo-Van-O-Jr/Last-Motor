import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  VehicleClassType,
  VEHICLE_CLASSES,
  VehicleState,
  CameraMode,
  TakedownEvent,
  MatchStats,
  ZoneState,
} from '../types/game';
import { buildCarMesh, CarVisualRefs } from './carBuilder';
import { buildArena, ArenaComponents } from './arenaBuilder';
import { PhysicsEngine, VehiclePhysicsEntity } from './physicsEngine';
import { AIController } from './aiController';
import { EffectsManager } from './effectsManager';
import { soundManager } from './sound';
import { CombatSystem } from './combatSystem';
import { DamageSystem, DamageEvent } from './damageSystem';
import { ZoneSystem } from './zoneSystem';
import { readPlayerAxes } from './playerInput';
import { ROYALE_CONFIG } from './royaleConfig';

export interface GameEngineCallbacks {
  onStateUpdate: (state: {
    player: VehicleState | null;
    survivors: number;
    matchTime: number;
    zoneRadius: number;
    zone: ZoneState;
    damageTotals: DamageSystem['totals'];
    allVehicles: VehicleState[];
  }) => void;
  onTakedownBanner: (banner: { title: string; subtitle: string; isPlayer: boolean }) => void;
  onCombatLog: (event: TakedownEvent) => void;
  onMatchEnd: (stats: MatchStats) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private physics: PhysicsEngine;
  private ai: AIController;
  private effects: EffectsManager;
  private damage: DamageSystem;
  private combat: CombatSystem | null = null;
  private zone = new ZoneSystem();
  private arena: ArenaComponents | null = null;

  private playerEntity: VehiclePhysicsEntity | null = null;
  private allEntities: VehiclePhysicsEntity[] = [];

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isShowroom: boolean = true;
  private showroomCar: CarVisualRefs | null = null;
  private showroomAngle: number = 0;

  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Match progression
  private matchTime: number = 0;
  private nextBroadcast = 0;
  private currentZoneRadius: number = 85;
  private useItemRequested = false;

  // Cinematic Slow-Motion
  private timeScale: number = 1.0;
  private slowMoTimer: number = 0;

  // Camera Settings
  private cameraMode: CameraMode = 'close';
  private cameraShakeIntensity: number = 0;
  private currentCamPos = new THREE.Vector3();
  private currentCamLook = new THREE.Vector3();

  // Keyboard and Virtual input state
  private keyState: Record<string, boolean> = {};
  private virtualInputs = {
    throttle: 0,
    steer: 0,
    drift: false,
    boost: false,
  };

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f17);
    this.scene.fog = new THREE.FogExp2(0x0c0f17, 0.007);

    // 2. Camera
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 400);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x475569, 1.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff1e6, 2.2);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    const d = 75;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // 5. Systems
    this.damage = new DamageSystem(event => this.onDamage(event));
    this.physics = new PhysicsEngine(this.damage);
    this.ai = new AIController();
    this.effects = new EffectsManager(this.scene);

    // 6. Listeners
    this.setupListeners();

    // 7. Start in Showroom mode immediately so canvas renders vibrant 3D scene
    this.setupShowroom('BRAWLER', '#f97316');
  }

  private setupListeners() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isRunning && !this.isShowroom && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE'].includes(e.code)) e.preventDefault();
    this.keyState[e.code] = true;
    if (e.code === 'KeyE' && !e.repeat) this.useItem();

    if (e.code === 'KeyC' && !e.repeat && !this.isPaused && !this.isShowroom) {
      this.toggleCamera();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keyState[e.code] = false;
  };

  private onBlur = () => {
    this.keyState = {};
    this.virtualInputs = { throttle: 0, steer: 0, drift: false, boost: false };
    this.useItemRequested = false;
  };

  public useItem() {
    if (this.isRunning && !this.isPaused && !this.isShowroom) this.useItemRequested = true;
  }

  public returnToMenu(classType: VehicleClassType, color: string) { this.setupShowroom(classType, color); }

  public setVirtualInput(key: 'throttle' | 'steer', value: number) {
    this.virtualInputs[key] = value;
  }

  public setVirtualButton(key: 'drift' | 'boost', active: boolean) {
    this.virtualInputs[key] = active;
  }

  public toggleCamera() {
    if (this.cameraMode === 'close') this.cameraMode = 'far';
    else if (this.cameraMode === 'far') this.cameraMode = 'hood';
    else this.cameraMode = 'close';
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    this.onBlur();
    if (paused) {
      soundManager.stopEngine();
      soundManager.setBoostSound(false);
      soundManager.setDriftSound(false);
    } else {
      soundManager.startEngine();
    }
  }

  public updateShowroom(classType: VehicleClassType, color?: string) {
    if (!this.isShowroom) return;
    if (this.showroomCar) {
      this.disposeObject(this.showroomCar.group);
      this.showroomCar = null;
    }
    this.showroomCar = buildCarMesh(classType, color);
    this.showroomCar.group.position.set(0, 0, 0);
    this.scene.add(this.showroomCar.group);
  }

  private setupShowroom(classType: VehicleClassType, color: string) {
    this.cleanup();
    this.isShowroom = true;
    this.isRunning = true;

    // Build arena in background
    this.arena = buildArena(this.scene, this.physics.world);

    this.updateShowroom(classType, color);

    this.lastTime = performance.now();
    this.showroomLoop();
  }

  private showroomLoop = () => {
    if (!this.isShowroom) return;
    this.animationFrameId = requestAnimationFrame(this.showroomLoop);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.showroomAngle += dt * 0.45;

    // Cinematic orbit camera
    const radius = 7.5;
    this.camera.position.set(
      Math.sin(this.showroomAngle) * radius,
      2.6 + Math.sin(this.showroomAngle * 0.5) * 0.5,
      Math.cos(this.showroomAngle) * radius
    );
    this.camera.lookAt(0, 0.9, 0);

    if (this.showroomCar) {
      this.showroomCar.group.rotation.y = this.showroomAngle * 0.2;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public startMatch(playerClass: VehicleClassType, playerColor?: string) {
    this.cleanup();

    this.isShowroom = false;
    this.matchTime = 0;
    this.nextBroadcast = 0;
    this.currentZoneRadius = 85;
    this.timeScale = 1.0;
    this.slowMoTimer = 0;
    this.cameraShakeIntensity = 0;
    this.isPaused = false;
    this.isRunning = true;

    // Build Arena Zero
    this.arena = buildArena(this.scene, this.physics.world);

    // Spawn 6 vehicles: 1 Player + 5 AI Opponents
    const spawnRadius = 45;
    const botClasses: VehicleClassType[] = ['INTERCEPTOR', 'BRAWLER', 'BRUISER', 'INTERCEPTOR', 'BRAWLER'];
    const botNames = ['Viper', 'Crusher', 'Juggernaut', 'Phantom', 'Wrecker'];
    const botColors = ['#0284c7', '#ea580c', '#e11d48', '#8b5cf6', '#10b981'];
    const botArchetypes: ('aggressive' | 'opportunist' | 'defensive')[] = [
      'aggressive',
      'opportunist',
      'aggressive',
      'defensive',
      'opportunist',
    ];

    // Spawn Player at index 0 (facing arena center)
    const pAngle = 0;
    const pX = Math.cos(pAngle) * spawnRadius;
    const pZ = Math.sin(pAngle) * spawnRadius;
    const pRotY = -pAngle - Math.PI / 2; // face center

    const pVisuals = buildCarMesh(playerClass, playerColor);
    this.scene.add(pVisuals.group);

    this.playerEntity = this.physics.registerVehicle(
      'player',
      'JOGADOR (VOCÊ)',
      true,
      playerClass,
      new THREE.Vector3(pX, 0, pZ),
      pRotY,
      pVisuals,
      playerColor || VEHICLE_CLASSES[playerClass].color
    );
    this.allEntities.push(this.playerEntity);

    // Spawn 5 AI Bots spaced evenly around perimeter
    for (let i = 0; i < 5; i++) {
      const bAngle = ((i + 1) / 6) * Math.PI * 2;
      const bX = Math.cos(bAngle) * spawnRadius;
      const bZ = Math.sin(bAngle) * spawnRadius;
      const bRotY = -bAngle - Math.PI / 2;

      const bClass = botClasses[i];
      const bName = botNames[i];
      const bColor = botColors[i];
      const bArch = botArchetypes[i];

      const bVisuals = buildCarMesh(bClass, bColor);
      this.scene.add(bVisuals.group);

      const bEntity = this.physics.registerVehicle(
        `bot_${i + 1}`,
        bName,
        false,
        bClass,
        new THREE.Vector3(bX, 0, bZ),
        bRotY,
        bVisuals,
        bColor,
        bArch
      );

      this.ai.registerBot(bEntity, bArch);
      this.allEntities.push(bEntity);
    }

    this.combat = new CombatSystem(this.scene, this.damage, () => this.arena ? [
      ...this.arena.staticBodies,
      ...this.arena.barrels.filter(b => !b.exploded).map(b => b.body),
    ] : [], {
      shot: (kind, pos) => {
        soundManager.playWeapon(kind);
        this.effects.emitSparks(pos, new THREE.Vector3(0, 1, 0), 5);
      },
      explosion: (pos, kind) => {
        if (kind === 'ENERGY') this.effects.emitSparks(pos, new THREE.Vector3(0, 1, 0), 15);
        else this.effects.emitExplosion(pos, false);
        soundManager.playCollision(kind === 'ENERGY' ? 0.3 : 0.65);
      },
      pickup: (car) => {
        this.effects.emitSparks(new THREE.Vector3(car.body.position.x, 1.5, car.body.position.z), new THREE.Vector3(0, 1, 0), 12);
        if (car.isPlayer) soundManager.playPickup();
      },
    });
    this.combat.setupPickups();

    // Start audio
    soundManager.startEngine();

    // Init camera position
    const pPos = this.playerEntity.body.position;
    this.currentCamPos.set(pPos.x, 3.2, pPos.z - 7.0);
    this.currentCamLook.set(pPos.x, 1.2, pPos.z + 4.0);

    // Start match loop
    this.lastTime = performance.now();
    this.loop();
  }

  private loop = () => {
    if (!this.isRunning || this.isShowroom) return;

    this.animationFrameId = requestAnimationFrame(this.loop);

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (dt > 0.1) dt = 0.1;

    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Slow-mo update
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      this.timeScale = THREE.MathUtils.lerp(this.timeScale, 0.28, 0.2);
      if (this.slowMoTimer <= 0) {
        this.timeScale = 1.0;
      }
    } else {
      this.timeScale = 1.0;
    }

    const simDt = dt * this.timeScale;
    this.update(simDt, dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(simDt: number, realDt: number) {
    this.matchTime += simDt;

    // 1. Player Input handling (merge Keyboard + On-screen virtual buttons)
    if (this.playerEntity && !this.playerEntity.state.isDead) {
      const inputs = this.playerEntity.inputs;

      const axes = readPlayerAxes(this.keyState, this.virtualInputs);
      inputs.throttle = axes.throttle;
      inputs.steer = axes.steer;
      if (this.useItemRequested) this.combat?.activate(this.playerEntity, this.allEntities);
      this.useItemRequested = false;

      inputs.drift = Boolean(this.keyState['Space'] || this.virtualInputs.drift);
      inputs.boost = Boolean(this.keyState['ShiftLeft'] || this.keyState['ShiftRight'] || this.virtualInputs.boost);

      // Audio feedback for player
      const speedRatio = Math.min(this.playerEntity.state.speedKmh / 200, 1);
      soundManager.updateEnginePitch(speedRatio, inputs.throttle > 0);
      soundManager.setBoostSound(this.playerEntity.state.isBoosting);
      soundManager.setDriftSound(this.playerEntity.state.isDrifting);
    }

    // 2. AI Opponent update
    const zoneState = this.zone.getState(this.matchTime);
    if (this.arena && this.combat) {
      this.ai.update(simDt, this.allEntities, zoneState.radius, this.combat, zoneState.nextRadius);
    }

    // 3. Update vehicle driving dynamics
    this.allEntities.forEach((entity) => {
      this.physics.updateVehicleDriving(entity, simDt);
      this.updateVehicleEffects(entity, simDt);
    });

    // 4. Physics step
    this.physics.step(simDt);

    // 5. Vehicle-to-Vehicle Collisions
    const collisionResults = this.physics.checkCollisions(this.matchTime);
    collisionResults.forEach((col) => {
      const attacker = this.allEntities.find((e) => e.id === col.attackerId);
      const victim = this.allEntities.find((e) => e.id === col.victimId);
      if (!attacker || !victim) return;

      const intensity = Math.min(col.impactSpeed / 120, 1.0);
      soundManager.playCollision(intensity);

      if (attacker.isPlayer || victim.isPlayer) {
        this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.45 * intensity);
      }

      const hitNormal = new THREE.Vector3(
        victim.body.position.x - attacker.body.position.x,
        0.5,
        victim.body.position.z - attacker.body.position.z
      ).normalize();
      this.effects.emitSparks(col.hitPosition, hitNormal, Math.round(15 * intensity));
    });

    this.combat?.update(simDt, this.allEntities, zoneState.radius);

    // 6. Barrel collisions
    this.checkBarrelCollisions();

    // 7. Shrinking zone
    this.updateShrinkingZone(simDt);

    // 8. Update Camera
    this.updateCamera(realDt);

    // 9. Update Particles
    this.effects.update(simDt);

    // 10. Check Win/Loss
    this.checkMatchConditions();

    // 11. Broadcast state
    const aliveCount = this.allEntities.filter((e) => !e.state.isDead).length;
    if (this.matchTime < this.nextBroadcast && this.isRunning) return;
    this.nextBroadcast = this.matchTime + 0.05;
    const snapshot = (state: VehicleState): VehicleState => ({ ...state, position: { ...state.position }, item: state.item ? { ...state.item } : null });
    this.callbacks.onStateUpdate({
      player: this.playerEntity ? snapshot(this.playerEntity.state) : null,
      survivors: aliveCount,
      matchTime: Math.floor(this.matchTime),
      zoneRadius: Math.round(this.currentZoneRadius),
      zone: zoneState,
      damageTotals: { ...this.damage.totals },
      allVehicles: this.allEntities.map((e) => snapshot(e.state)),
    });
  }

  private onDamage(event: DamageEvent) {
    const { victim, attacker, source, deadly, label } = event;
    if ((victim.isPlayer || attacker?.isPlayer) && source === 'weapons') this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.2);
    if (!deadly) return;
    const pos = new THREE.Vector3(victim.body.position.x, 1, victim.body.position.z);
    this.effects.emitExplosion(pos, true);
    soundManager.playTakedown();
    const attackerName = attacker && attacker !== victim ? attacker.name : label;
    if (victim.isPlayer || attacker?.isPlayer) {
      this.slowMoTimer = 1.1;
      this.cameraShakeIntensity = 0.85;
      this.callbacks.onTakedownBanner({ title: victim.isPlayer ? 'VEÍCULO ELIMINADO' : 'ELIMINAÇÃO!', subtitle: `${attackerName} • ${label} • ${victim.name}`, isPlayer: Boolean(attacker?.isPlayer && attacker !== victim) });
    }
    this.callbacks.onCombatLog({ id: `${victim.id}-${this.matchTime}`, victimName: victim.name, attackerName,
      isPlayerInvolved: victim.isPlayer || Boolean(attacker?.isPlayer), type: source === 'environment' ? 'ENVIRONMENTAL' : 'TAKEDOWN',
      message: `${attackerName} eliminou ${victim.name} • ${label}`, timestamp: Date.now() });
  }

  private checkBarrelCollisions() {
    if (!this.arena) return;

    this.arena.barrels.forEach((barrel) => {
      if (barrel.exploded) return;

      this.allEntities.forEach((car) => {
        if (car.state.isDead || barrel.exploded) return;

        const dist = car.body.position.distanceTo(barrel.body.position);
        if (dist < 3.2 && car.state.speedKmh > 22) {
          barrel.exploded = true;
          barrel.mesh.removeFromParent();
          this.physics.world.removeBody(barrel.body);

          const blastPos = new THREE.Vector3(barrel.body.position.x, 1.2, barrel.body.position.z);
          this.effects.emitExplosion(blastPos, true);
          soundManager.playTakedown();

          if (car.isPlayer) {
            this.cameraShakeIntensity = 0.7;
          }

          this.allEntities.forEach((nearCar) => {
            if (nearCar.state.isDead) return;
            const distToBlast = Math.hypot(
              nearCar.body.position.x - blastPos.x,
              nearCar.body.position.z - blastPos.z
            );
            if (distToBlast < ROYALE_CONFIG.environment.barrelRadius) {
              const dmg = (1 - distToBlast / ROYALE_CONFIG.environment.barrelRadius) * ROYALE_CONFIG.environment.barrelDamage;
              this.damage.apply(nearCar, dmg, 'environment', this.matchTime, car, 'BARRIL');
            }
          });
        }
      });
    });
  }

  private updateShrinkingZone(dt: number) {
    if (!this.arena) return;
    const state = this.zone.getState(this.matchTime);
    this.currentZoneRadius = state.radius;
    this.arena.updateZone(state.radius);
    this.arena.nextZoneMesh.scale.setScalar(state.nextRadius);
    this.arena.nextZoneMesh.visible = state.status !== 'final';
    for (const car of this.allEntities) {
      if (car.state.isDead) continue;
      if (Math.hypot(car.body.position.x, car.body.position.z) > state.radius) {
        this.damage.apply(car, state.damagePerSec * dt, 'environment', this.matchTime, undefined, 'ZONA');
        if (Math.random() > 0.7) this.effects.emitSparks(car.visuals.group.position, new THREE.Vector3(0, 1, 0), 2);
      }
    }
  }

  private updateVehicleEffects(entity: VehiclePhysicsEntity, dt: number) {
    const { visuals, state } = entity;
    const heading = state.heading;

    if (state.isDrifting && state.speedKmh > 20) {
      visuals.wheelMeshes.forEach((w, idx) => {
        if (idx >= 2) {
          const wWorldPos = new THREE.Vector3();
          w.getWorldPosition(wWorldPos);
          this.effects.emitDriftSmoke(wWorldPos, 1.2);
          if (Math.random() > 0.6) {
            this.effects.addSkidmark(wWorldPos, heading);
          }
        }
      });
    }

    if (state.isBoosting) {
      visuals.exhaustPoints.forEach((ep) => {
        const flamePos = ep.clone().applyMatrix4(visuals.group.matrixWorld);
        this.effects.emitNitroFlame(flamePos, heading);
      });
    }

    const hpRatio = state.hp / state.maxHp;
    if (hpRatio < 0.6 && !state.isDead) {
      const bayWorldPos = visuals.engineBayPoint.clone().applyMatrix4(visuals.group.matrixWorld);
      if (Math.random() > 0.35) {
        this.effects.emitDamageSmoke(bayWorldPos, hpRatio < 0.25);
      }
    }
  }

  private updateCamera(dt: number) {
    if (!this.playerEntity) return;

    const pPos = this.playerEntity.body.position;
    const pRotY = this.playerEntity.state.heading;
    const speedKmh = this.playerEntity.state.speedKmh;
    const isBoosting = this.playerEntity.state.isBoosting;

    let targetOffset: THREE.Vector3;
    let targetLookOffset: THREE.Vector3;

    if (this.cameraMode === 'hood') {
      targetOffset = new THREE.Vector3(0, 1.35, 0.4);
      targetLookOffset = new THREE.Vector3(0, 1.2, 12);
    } else if (this.cameraMode === 'far') {
      const speedDist = (speedKmh / 200) * 2.5;
      targetOffset = new THREE.Vector3(0, 4.8, -9.5 - speedDist);
      targetLookOffset = new THREE.Vector3(0, 1.4, 4.0);
    } else {
      const speedDist = (speedKmh / 200) * 1.8;
      targetOffset = new THREE.Vector3(0, 3.1 + (isBoosting ? 0.4 : 0), -6.6 - speedDist);
      targetLookOffset = new THREE.Vector3(0, 1.25, 4.0);
    }

    const baseFov = 62;
    const targetFov = baseFov + (speedKmh / 200) * 10 + (isBoosting ? 12 : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 5);
    this.camera.updateProjectionMatrix();

    const rotMatrix = new THREE.Matrix4().makeRotationY(pRotY);
    const worldOffset = targetOffset.clone().applyMatrix4(rotMatrix);
    const worldLookOffset = targetLookOffset.clone().applyMatrix4(rotMatrix);

    const targetPos = new THREE.Vector3(pPos.x + worldOffset.x, pPos.y + worldOffset.y, pPos.z + worldOffset.z);
    const targetLook = new THREE.Vector3(
      pPos.x + worldLookOffset.x,
      pPos.y + worldLookOffset.y,
      pPos.z + worldLookOffset.z
    );

    const lerpSpeed = this.cameraMode === 'hood' ? 24 : 9.0;
    this.currentCamPos.lerp(targetPos, dt * lerpSpeed);
    this.currentCamLook.lerp(targetLook, dt * (lerpSpeed + 2));

    if (this.cameraShakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity * 1.4;
      const shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity * 1.4;
      const shakeZ = (Math.random() - 0.5) * this.cameraShakeIntensity * 1.4;

      this.camera.position.set(
        this.currentCamPos.x + shakeX,
        Math.max(0.6, this.currentCamPos.y + shakeY),
        this.currentCamPos.z + shakeZ
      );
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 2.2);
    } else {
      this.camera.position.set(
        this.currentCamPos.x,
        Math.max(0.6, this.currentCamPos.y),
        this.currentCamPos.z
      );
    }

    this.camera.lookAt(this.currentCamLook);
  }

  private checkMatchConditions() {
    if (!this.isRunning || this.isShowroom) return;

    const aliveVehicles = this.allEntities.filter((e) => !e.state.isDead);
    const isPlayerAlive = this.playerEntity && !this.playerEntity.state.isDead;

    if (aliveVehicles.length === 1 && isPlayerAlive) {
      this.endMatch(true);
      return;
    }

    if (!isPlayerAlive) {
      this.endMatch(false);
      return;
    }
  }

  private endMatch(isVictory: boolean) {
    this.isRunning = false;
    soundManager.stopEngine();
    soundManager.setBoostSound(false);
    soundManager.setDriftSound(false);

    if (isVictory) {
      soundManager.playVictory();
    } else {
      soundManager.playGameOver();
    }

    const aliveCount = this.allEntities.filter((e) => !e.state.isDead).length;
    const placement = isVictory ? 1 : Math.min(6, aliveCount + 1);

    const stats: MatchStats = {
      placement,
      totalTakedowns: this.playerEntity ? this.playerEntity.state.takedowns : 0,
      totalDamage: this.playerEntity ? this.playerEntity.state.damageDealt : 0,
      survivalTimeSec: Math.floor(this.matchTime),
      isVictory,
    };

    this.callbacks.onMatchEnd(stats);
  }

  public cleanup() {
    this.isRunning = false;
    this.isPaused = false;
    this.onBlur();
    this.combat?.clear();
    this.combat = null;
    this.damage.reset();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    soundManager.stopEngine();
    soundManager.setBoostSound(false);
    soundManager.setDriftSound(false);

    if (this.showroomCar) {
      this.disposeObject(this.showroomCar.group);
      this.showroomCar = null;
    }

    this.allEntities.forEach((e) => {
      this.disposeObject(e.visuals.group);
      this.physics.world.removeBody(e.body);
    });
    this.physics.vehicles.clear();
    this.allEntities = [];
    this.playerEntity = null;
    this.ai.clear();
    this.effects.clearAll();

    if (this.arena) {
      this.disposeObject(this.arena.sceneGroup);
      this.arena.staticBodies.forEach((b) => this.physics.world.removeBody(b));
      this.arena.barrels.forEach((b) => {
        if (!b.exploded) this.physics.world.removeBody(b.body);
      });
      this.arena = null;
    }
  }

  private disposeObject(object: THREE.Object3D) {
    object.removeFromParent();
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
  }

  public destroy() {
    this.cleanup();
    this.effects.destroy();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
