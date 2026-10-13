import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface DestructibleBarrel {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  exploded: boolean;
  position: THREE.Vector3;
}

export interface ArenaComponents {
  sceneGroup: THREE.Group;
  staticBodies: CANNON.Body[];
  barrels: DestructibleBarrel[];
  arenaRadius: number;
  zoneMesh: THREE.Mesh;
  updateZone: (radius: number) => void;
}

export function buildArena(scene: THREE.Scene, world: CANNON.World): ArenaComponents {
  const arenaGroup = new THREE.Group();
  arenaGroup.name = 'ArenaZero';
  const staticBodies: CANNON.Body[] = [];
  const barrels: DestructibleBarrel[] = [];

  const arenaRadius = 85; // 170m across - spacious enough for high-speed runs and tactical combat

  // Materials
  // Procedural canvas asphalt texture with noise and grit
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#22252a';
  ctx.fillRect(0, 0, 512, 512);

  // Noise specks
  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.15;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Industrial grid lines
  ctx.strokeStyle = '#333b45';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Starting grid markers / yellow crosshatch in center
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 8;
  ctx.strokeRect(192, 192, 128, 128);

  const asphaltTex = new THREE.CanvasTexture(canvas);
  asphaltTex.wrapS = THREE.RepeatWrapping;
  asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.repeat.set(18, 18);

  const groundMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.85,
    metalness: 0.15,
  });

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(arenaRadius * 2.5, arenaRadius * 2.5);
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  arenaGroup.add(groundMesh);

  // Physics ground plane
  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);
  staticBodies.push(groundBody);

  // Concrete & Hazard Textures
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.7,
    metalness: 0.2,
  });

  const hazardCanvas = document.createElement('canvas');
  hazardCanvas.width = 256;
  hazardCanvas.height = 64;
  const hCtx = hazardCanvas.getContext('2d')!;
  hCtx.fillStyle = '#eab308';
  hCtx.fillRect(0, 0, 256, 64);
  hCtx.fillStyle = '#18181b';
  for (let i = -64; i < 320; i += 40) {
    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + 30, 0);
    hCtx.lineTo(i - 10, 64);
    hCtx.lineTo(i - 40, 64);
    hCtx.closePath();
    hCtx.fill();
  }
  const hazardTex = new THREE.CanvasTexture(hazardCanvas);
  hazardTex.wrapS = THREE.RepeatWrapping;
  hazardTex.repeat.set(4, 1);

  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.5,
  });

  // Perimeter Arena Wall (16-sided polygon)
  const segments = 24;
  const wallHeight = 4.5;
  const wallThickness = 2.0;

  for (let i = 0; i < segments; i++) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;
    const midAngle = (angle1 + angle2) / 2;

    const x1 = Math.cos(angle1) * arenaRadius;
    const z1 = Math.sin(angle1) * arenaRadius;
    const x2 = Math.cos(angle2) * arenaRadius;
    const z2 = Math.sin(angle2) * arenaRadius;

    const segLen = Math.hypot(x2 - x1, z2 - z1);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;

    // Wall Mesh
    const wallGeo = new THREE.BoxGeometry(segLen, wallHeight, wallThickness);
    const wallMesh = new THREE.Mesh(wallGeo, i % 2 === 0 ? barrierMat : hazardMat);
    wallMesh.position.set(midX, wallHeight / 2, midZ);
    wallMesh.rotation.y = -midAngle + Math.PI / 2;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    arenaGroup.add(wallMesh);

    // Fence wire on top
    const fenceGeo = new THREE.BoxGeometry(segLen, 2.5, 0.1);
    const fenceMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      wireframe: true,
    });
    const fenceMesh = new THREE.Mesh(fenceGeo, fenceMat);
    fenceMesh.position.set(midX, wallHeight + 1.25, midZ);
    fenceMesh.rotation.y = -midAngle + Math.PI / 2;
    arenaGroup.add(fenceMesh);

    // Physics body
    const wallBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(segLen / 2, wallHeight / 2 + 1.5, wallThickness / 2)),
    });
    wallBody.position.set(midX, wallHeight / 2, midZ);
    wallBody.quaternion.setFromEuler(0, -midAngle + Math.PI / 2, 0);
    world.addBody(wallBody);
    staticBodies.push(wallBody);
  }

  // Industrial Floodlight Stadium Towers (4 corners)
  const towerPositions = [
    new THREE.Vector3(arenaRadius * 0.72, 0, arenaRadius * 0.72),
    new THREE.Vector3(-arenaRadius * 0.72, 0, arenaRadius * 0.72),
    new THREE.Vector3(arenaRadius * 0.72, 0, -arenaRadius * 0.72),
    new THREE.Vector3(-arenaRadius * 0.72, 0, -arenaRadius * 0.72),
  ];

  towerPositions.forEach((pos) => {
    // Truss pole
    const poleGeo = new THREE.CylinderGeometry(0.5, 0.9, 18, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(pos.x, 9, pos.z);
    arenaGroup.add(pole);

    // Light head
    const headGeo = new THREE.BoxGeometry(4, 2, 1.5);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff0dd,
      emissiveIntensity: 3.0,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(pos.x, 18, pos.z);
    head.lookAt(0, 2, 0);
    arenaGroup.add(head);

    // SpotLight
    const spotLight = new THREE.SpotLight(0xfff7ed, 400, 160, Math.PI / 4, 0.4);
    spotLight.position.set(pos.x, 18, pos.z);
    spotLight.target.position.set(0, 0, 0);
    scene.add(spotLight.target);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    arenaGroup.add(spotLight);
  });

  // Shipping Containers setup (creating tactical arenas, choke points, and cover)
  const containerColors = [0x0284c7, 0xe11d48, 0xd97706, 0x16a34a, 0x4f46e5];
  const containerConfigs = [
    // Center-left cluster
    { x: -32, z: 12, rot: 0.3, color: containerColors[0] },
    { x: -32, z: 20, rot: 0.3, color: containerColors[1] },
    { x: -32, z: 16, y: 3.2, rot: 0.3, color: containerColors[2] }, // stacked!

    // Center-right cluster
    { x: 30, z: -15, rot: -0.4, color: containerColors[3] },
    { x: 30, z: -23, rot: -0.4, color: containerColors[4] },
    { x: 30, z: -19, y: 3.2, rot: -0.4, color: containerColors[0] },

    // North barrier
    { x: 10, z: 42, rot: 1.57, color: containerColors[1] },
    { x: 22, z: 42, rot: 1.57, color: containerColors[2] },

    // South barrier
    { x: -15, z: -45, rot: 1.57, color: containerColors[3] },
    { x: -27, z: -45, rot: 1.57, color: containerColors[0] },
  ];

  const cWidth = 3.2;
  const cHeight = 3.0;
  const cLength = 7.5;

  containerConfigs.forEach((cfg) => {
    const cMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      roughness: 0.4,
      metalness: 0.7,
    });
    const cGeo = new THREE.BoxGeometry(cWidth, cHeight, cLength);
    const cMesh = new THREE.Mesh(cGeo, cMat);
    const posY = cfg.y ? cfg.y : cHeight / 2;
    cMesh.position.set(cfg.x, posY, cfg.z);
    cMesh.rotation.y = cfg.rot;
    cMesh.castShadow = true;
    cMesh.receiveShadow = true;
    arenaGroup.add(cMesh);

    // Physics body
    const cBody = new CANNON.Body({
      mass: 0, // static obstacle
      shape: new CANNON.Box(new CANNON.Vec3(cWidth / 2, cHeight / 2, cLength / 2)),
    });
    cBody.position.set(cfg.x, posY, cfg.z);
    cBody.quaternion.setFromEuler(0, cfg.rot, 0);
    world.addBody(cBody);
    staticBodies.push(cBody);
  });

  // Jump Ramps for sick aerial takedowns!
  const rampConfigs = [
    { x: 0, z: 28, rot: 0 },
    { x: 0, z: -28, rot: Math.PI },
    { x: 38, z: 15, rot: -Math.PI / 2 },
    { x: -38, z: -15, rot: Math.PI / 2 },
  ];

  rampConfigs.forEach((rc) => {
    const rampW = 6.0;
    const rampL = 10.0;
    const rampH = 2.4;

    const rampShape = new THREE.Shape();
    rampShape.moveTo(-rampL / 2, 0);
    rampShape.lineTo(rampL / 2, rampH);
    rampShape.lineTo(rampL / 2, 0);
    rampShape.closePath();

    const extrudeSettings = {
      depth: rampW,
      bevelEnabled: false,
    };

    const rampGeo = new THREE.ExtrudeGeometry(rampShape, extrudeSettings);
    rampGeo.center();

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.6,
      roughness: 0.3,
    });

    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.set(rc.x, rampH / 2, rc.z);
    rampMesh.rotation.y = rc.rot;
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    arenaGroup.add(rampMesh);

    // In physics, create an inclined box for the ramp surface
    const rampAngle = Math.atan2(rampH, rampL);
    const hypLen = Math.hypot(rampL, rampH);
    const pBox = new CANNON.Box(new CANNON.Vec3(hypLen / 2, 0.4, rampW / 2));
    const pBody = new CANNON.Body({
      mass: 0,
      shape: pBox,
    });
    pBody.position.set(rc.x, rampH / 2, rc.z);
    const q1 = new CANNON.Quaternion();
    q1.setFromEuler(0, rc.rot, 0);
    const q2 = new CANNON.Quaternion();
    q2.setFromEuler(0, 0, rampAngle);
    pBody.quaternion = q1.mult(q2);
    world.addBody(pBody);
    staticBodies.push(pBody);
  });

  // Destructible / Explosive Red Fuel Barrels!
  const barrelPositions = [
    new THREE.Vector3(-14, 0.9, 8),
    new THREE.Vector3(-16, 0.9, 8),
    new THREE.Vector3(-15, 2.3, 8), // on top
    new THREE.Vector3(14, 0.9, -8),
    new THREE.Vector3(16, 0.9, -8),
    new THREE.Vector3(0, 0.9, 0),
    new THREE.Vector3(20, 0.9, 24),
    new THREE.Vector3(-20, 0.9, -24),
    new THREE.Vector3(45, 0.9, 0),
    new THREE.Vector3(-45, 0.9, 0),
  ];

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.7,
    roughness: 0.3,
  });

  barrelPositions.forEach((pos) => {
    const bGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12);
    const bMesh = new THREE.Mesh(bGeo, barrelMat);
    bMesh.position.copy(pos);
    bMesh.castShadow = true;
    arenaGroup.add(bMesh);

    // Hazard stripe band on barrel
    const bandGeo = new THREE.CylinderGeometry(0.57, 0.57, 0.3, 12);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    bMesh.add(band);

    const bBody = new CANNON.Body({
      mass: 120, // pushable!
      shape: new CANNON.Cylinder(0.55, 0.55, 1.4, 8),
    });
    bBody.position.set(pos.x, pos.y, pos.z);
    world.addBody(bBody);

    barrels.push({
      mesh: bMesh,
      body: bBody,
      exploded: false,
      position: pos.clone(),
    });
  });

  // Neon Arena Signboards ("ARENA ZERO" / "ÚLTIMO MOTOR")
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 128;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.fillStyle = '#090d16';
  sCtx.fillRect(0, 0, 512, 128);
  sCtx.strokeStyle = '#ef4444';
  sCtx.lineWidth = 6;
  sCtx.strokeRect(6, 6, 500, 116);
  sCtx.fillStyle = '#ffffff';
  sCtx.font = 'bold 50px sans-serif';
  sCtx.textAlign = 'center';
  sCtx.fillText('ÚLTIMO MOTOR', 256, 60);
  sCtx.fillStyle = '#f59e0b';
  sCtx.font = 'bold 30px sans-serif';
  sCtx.fillText('★ ARENA ZERO ★', 256, 102);

  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0x331111,
    emissiveIntensity: 0.6,
  });

  const signMesh1 = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), signMat);
  signMesh1.position.set(0, 8, -arenaRadius + 3);
  arenaGroup.add(signMesh1);

  const signMesh2 = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), signMat);
  signMesh2.position.set(0, 8, arenaRadius - 3);
  signMesh2.rotation.y = Math.PI;
  arenaGroup.add(signMesh2);

  // Shrinking Safe Zone Cylinder (Electric barrier)
  const zoneGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius, 15, 48, 1, true);
  const zoneMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    wireframe: false,
  });
  const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
  zoneMesh.position.set(0, 7.5, 0);
  arenaGroup.add(zoneMesh);

  // Function to update safe zone radius
  const updateZone = (radius: number) => {
    zoneMesh.scale.set(radius / arenaRadius, 1, radius / arenaRadius);
    // When very small, make it pulse red for urgency
    if (radius < 35) {
      zoneMat.color.setHex(0xef4444);
      zoneMat.emissive.setHex(0xb91c1c);
      zoneMat.opacity = 0.4 + Math.sin(Date.now() * 0.008) * 0.15;
    } else {
      zoneMat.color.setHex(0x38bdf8);
      zoneMat.emissive.setHex(0x0284c7);
      zoneMat.opacity = 0.28;
    }
  };

  scene.add(arenaGroup);

  return {
    sceneGroup: arenaGroup,
    staticBodies,
    barrels,
    arenaRadius,
    zoneMesh,
    updateZone,
  };
}
