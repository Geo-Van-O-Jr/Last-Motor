import * as THREE from 'three';
import { VehicleClassType, VEHICLE_CLASSES } from '../types/game';

export interface CarVisualRefs {
  group: THREE.Group;
  wheelMeshes: THREE.Group[];
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  exhaustPoints: THREE.Vector3[];
  engineBayPoint: THREE.Vector3;
  bodyMaterials: THREE.MeshStandardMaterial[];
  hazardLights?: THREE.Mesh[];
  classType: VehicleClassType;
}

export function buildCarMesh(classType: VehicleClassType, customColor?: string): CarVisualRefs {
  const config = VEHICLE_CLASSES[classType];
  const primaryHex = customColor || config.color;
  const secondaryHex = config.secondaryColor;
  const accentHex = config.accentColor;

  const carGroup = new THREE.Group();
  carGroup.name = `Car_${classType}_${Math.random().toString(36).substring(2, 6)}`;

  const bodyMaterials: THREE.MeshStandardMaterial[] = [];

  const mainBodyMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    metalness: 0.65,
    roughness: 0.25,
  });
  bodyMaterials.push(mainBodyMat);

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: secondaryHex,
    metalness: 0.7,
    roughness: 0.4,
  });
  bodyMaterials.push(darkTrimMat);

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.5,
    roughness: 0.3,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.95,
    roughness: 0.1,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    metalness: 0.9,
    roughness: 0.05,
    transparent: true,
    opacity: 0.85,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1f1f22,
    roughness: 0.9,
    metalness: 0.1,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.2,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xddf4ff,
    emissiveIntensity: 2.5,
    roughness: 0.1,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff1111,
    emissive: 0xff0022,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  const exhaustPoints: THREE.Vector3[] = [];
  let engineBayPoint = new THREE.Vector3(0, 0.8, 1.4);

  // Wheel tracking
  const wheelMeshes: THREE.Group[] = [];

  const createWheel = (radius: number, width: number): THREE.Group => {
    const wheelG = new THREE.Group();
    // Tire cylinder oriented along X axis
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    wheelG.add(tire);

    // Rim hub
    const rimGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width * 1.02, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelG.add(rim);

    // Rim spoke detail
    const spokeGeo = new THREE.BoxGeometry(width * 1.03, radius * 1.1, radius * 0.15);
    const spoke1 = new THREE.Mesh(spokeGeo, chromeMat);
    const spoke2 = spoke1.clone();
    spoke2.rotation.x = Math.PI / 2;
    wheelG.add(spoke1);
    wheelG.add(spoke2);

    return wheelG;
  };

  // Dimensions
  const W = config.width;
  const H = config.height;
  const L = config.length;

  let wheelRadius = 0.42;
  let wheelWidth = 0.32;
  let wheelY = 0.42;
  let frontWheelZ = L * 0.32;
  let rearWheelZ = -L * 0.32;
  let wheelX = W * 0.52;

  // Build chassis according to class
  if (classType === 'INTERCEPTOR') {
    wheelRadius = 0.38;
    wheelWidth = 0.28;
    wheelY = 0.38;

    // Lower, wedge-shaped sports body
    // Lower main hull
    const hullGeo = new THREE.BoxGeometry(W * 0.88, H * 0.35, L * 0.95);
    const hull = new THREE.Mesh(hullGeo, mainBodyMat);
    hull.position.y = 0.45;
    hull.castShadow = true;
    carGroup.add(hull);

    // Front wedge taper
    const noseGeo = new THREE.CylinderGeometry(0.01, W * 0.86, L * 0.4, 4);
    noseGeo.rotateY(Math.PI / 4);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, mainBodyMat);
    nose.position.set(0, 0.42, L * 0.32);
    nose.scale.set(1, 0.4, 1);
    carGroup.add(nose);

    // Aerodynamic Cabin / Cockpit
    const cabinGeo = new THREE.BoxGeometry(W * 0.72, H * 0.45, L * 0.45);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.72, -L * 0.05);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Rear engine cover / louvers
    const louverGeo = new THREE.BoxGeometry(W * 0.68, 0.12, L * 0.3);
    const louver = new THREE.Mesh(louverGeo, darkTrimMat);
    louver.position.set(0, 0.65, -L * 0.28);
    carGroup.add(louver);

    // Big Racing GT Wing / Spoiler
    const wingGeo = new THREE.BoxGeometry(W * 0.95, 0.06, 0.35);
    const wing = new THREE.Mesh(wingGeo, accentMat);
    wing.position.set(0, 0.95, -L * 0.44);
    carGroup.add(wing);

    const pillarGeo = new THREE.BoxGeometry(0.06, 0.32, 0.15);
    const p1 = new THREE.Mesh(pillarGeo, darkTrimMat);
    p1.position.set(W * 0.35, 0.8, -L * 0.44);
    const p2 = p1.clone();
    p2.position.x = -W * 0.35;
    carGroup.add(p1, p2);

    // Sharp Front Splitter
    const splitterGeo = new THREE.BoxGeometry(W * 0.92, 0.08, 0.3);
    const splitter = new THREE.Mesh(splitterGeo, darkTrimMat);
    splitter.position.set(0, 0.22, L * 0.48);
    carGroup.add(splitter);

    // Headlights (angular sharp slits)
    const hlGeo = new THREE.BoxGeometry(0.35, 0.08, 0.15);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(W * 0.3, 0.48, L * 0.46);
    hlL.rotation.y = -0.15;
    const hlR = hlL.clone();
    hlR.position.x = -W * 0.3;
    hlR.rotation.y = 0.15;
    carGroup.add(hlL, hlR);
    headlights.push(hlL, hlR);

    // Taillight bar
    const tlGeo = new THREE.BoxGeometry(W * 0.75, 0.08, 0.08);
    const tl = new THREE.Mesh(tlGeo, taillightMat);
    tl.position.set(0, 0.52, -L * 0.47);
    carGroup.add(tl);
    taillights.push(tl);

    // Dual Exhausts
    exhaustPoints.push(new THREE.Vector3(W * 0.25, 0.3, -L * 0.48));
    exhaustPoints.push(new THREE.Vector3(-W * 0.25, 0.3, -L * 0.48));
    engineBayPoint = new THREE.Vector3(0, 0.7, L * 0.2);

  } else if (classType === 'BRAWLER') {
    wheelRadius = 0.44;
    wheelWidth = 0.34;
    wheelY = 0.44;

    // Muscular stance
    const lowerBodyGeo = new THREE.BoxGeometry(W * 0.9, H * 0.42, L * 0.92);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, mainBodyMat);
    lowerBody.position.y = 0.52;
    lowerBody.castShadow = true;
    carGroup.add(lowerBody);

    // Dual Racing Stripes
    const stripeGeo = new THREE.BoxGeometry(0.35, 0.02, L * 0.88);
    const stripe1 = new THREE.Mesh(stripeGeo, accentMat);
    stripe1.position.set(0.25, 0.74, 0.02);
    const stripe2 = stripe1.clone();
    stripe2.position.set(-0.25, 0.74, 0.02);
    carGroup.add(stripe1, stripe2);

    // Fastback muscle roof & cabin
    const cabinGeo = new THREE.BoxGeometry(W * 0.78, H * 0.48, L * 0.5);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.86, -L * 0.06);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Supercharger Chrome Blower on Hood!
    const blowerGeo = new THREE.BoxGeometry(0.45, 0.25, 0.5);
    const blower = new THREE.Mesh(blowerGeo, chromeMat);
    blower.position.set(0, 0.85, L * 0.2);
    carGroup.add(blower);

    const scoopGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8);
    scoopGeo.rotateZ(Math.PI / 2);
    const scoop = new THREE.Mesh(scoopGeo, darkTrimMat);
    scoop.position.set(0, 0.92, L * 0.38);
    carGroup.add(scoop);

    // Reinforced Steel Bull-Bar / Ramming Bumper
    const ramBarGeo = new THREE.BoxGeometry(W * 0.95, 0.22, 0.25);
    const ramBar = new THREE.Mesh(ramBarGeo, darkTrimMat);
    ramBar.position.set(0, 0.42, L * 0.48);
    carGroup.add(ramBar);

    // Bull bar grill guards
    const guardGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35);
    const g1 = new THREE.Mesh(guardGeo, chromeMat);
    g1.position.set(W * 0.25, 0.55, L * 0.5);
    const g2 = g1.clone();
    g2.position.x = -W * 0.25;
    carGroup.add(g1, g2);

    // Twin Round Headlights
    const hlGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
    hlGeo.rotateX(Math.PI / 2);
    const hlL1 = new THREE.Mesh(hlGeo, headlightMat);
    hlL1.position.set(W * 0.32, 0.55, L * 0.47);
    const hlL2 = hlL1.clone();
    hlL2.position.x = W * 0.2;
    const hlR1 = hlL1.clone();
    hlR1.position.x = -W * 0.32;
    const hlR2 = hlL1.clone();
    hlR2.position.x = -W * 0.2;
    carGroup.add(hlL1, hlL2, hlR1, hlR2);
    headlights.push(hlL1, hlL2, hlR1, hlR2);

    // Quad Taillights
    const tlGeo = new THREE.BoxGeometry(0.2, 0.14, 0.06);
    const tl1 = new THREE.Mesh(tlGeo, taillightMat);
    tl1.position.set(W * 0.3, 0.6, -L * 0.47);
    const tl2 = tl1.clone();
    tl2.position.x = -W * 0.3;
    carGroup.add(tl1, tl2);
    taillights.push(tl1, tl2);

    // Dual Rear Exhausts
    exhaustPoints.push(new THREE.Vector3(W * 0.28, 0.32, -L * 0.48));
    exhaustPoints.push(new THREE.Vector3(-W * 0.28, 0.32, -L * 0.48));
    engineBayPoint = new THREE.Vector3(0, 0.85, L * 0.25);

  } else {
    // BRUISER - Massive armored demolition monster
    wheelRadius = 0.55;
    wheelWidth = 0.44;
    wheelY = 0.55;

    // Heavy Boxy Armored Chassis
    const baseGeo = new THREE.BoxGeometry(W * 0.88, H * 0.48, L * 0.95);
    const base = new THREE.Mesh(baseGeo, mainBodyMat);
    base.position.y = 0.7;
    base.castShadow = true;
    carGroup.add(base);

    // Armored Cab
    const cabGeo = new THREE.BoxGeometry(W * 0.84, H * 0.5, L * 0.45);
    const cab = new THREE.Mesh(cabGeo, darkTrimMat);
    cab.position.set(0, 1.15, -L * 0.05);
    cab.castShadow = true;
    carGroup.add(cab);

    // Window Grating / Slits
    const windowGeo = new THREE.BoxGeometry(W * 0.75, 0.28, 0.06);
    const frontWindow = new THREE.Mesh(windowGeo, glassMat);
    frontWindow.position.set(0, 1.2, L * 0.18);
    carGroup.add(frontWindow);

    // External Roll-Cage / Armor Plate on roof
    const roofPlateGeo = new THREE.BoxGeometry(W * 0.8, 0.08, L * 0.42);
    const roofPlate = new THREE.Mesh(roofPlateGeo, accentMat);
    roofPlate.position.set(0, 1.42, -L * 0.05);
    carGroup.add(roofPlate);

    // Massive Heavy Industrial Push-Bumper (Plow style!)
    const plowGeo = new THREE.BoxGeometry(W * 1.05, 0.42, 0.35);
    const plow = new THREE.Mesh(plowGeo, darkTrimMat);
    plow.position.set(0, 0.55, L * 0.5);
    carGroup.add(plow);

    // Heavy Spikes / Teeth on Plow
    for (let i = -2; i <= 2; i++) {
      const toothGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
      toothGeo.rotateX(Math.PI / 2);
      const tooth = new THREE.Mesh(toothGeo, chromeMat);
      tooth.position.set(i * 0.42, 0.55, L * 0.68);
      carGroup.add(tooth);
    }

    // Heavy Vertical Smokestacks (Exhausts like semi-truck!)
    const stackGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8);
    const stackL = new THREE.Mesh(stackGeo, chromeMat);
    stackL.position.set(W * 0.42, 1.35, -L * 0.22);
    const stackR = stackL.clone();
    stackR.position.x = -W * 0.42;
    carGroup.add(stackL, stackR);

    // Headlights (High-mounted flood beam pods)
    const hlGeo = new THREE.BoxGeometry(0.3, 0.18, 0.15);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(W * 0.38, 0.8, L * 0.46);
    const hlR = hlL.clone();
    hlR.position.x = -W * 0.38;
    carGroup.add(hlL, hlR);
    headlights.push(hlL, hlR);

    // Heavy rear guard and taillights
    const tlGeo = new THREE.BoxGeometry(0.35, 0.14, 0.08);
    const tlL = new THREE.Mesh(tlGeo, taillightMat);
    tlL.position.set(W * 0.35, 0.7, -L * 0.48);
    const tlR = tlL.clone();
    tlR.position.x = -W * 0.35;
    carGroup.add(tlL, tlR);
    taillights.push(tlL, tlR);

    // Exhaust emitters at top of smokestacks!
    exhaustPoints.push(new THREE.Vector3(W * 0.42, 1.9, -L * 0.22));
    exhaustPoints.push(new THREE.Vector3(-W * 0.42, 1.9, -L * 0.22));
    engineBayPoint = new THREE.Vector3(0, 0.95, L * 0.3);
  }

  // Create Wheels
  const flWheel = createWheel(wheelRadius, wheelWidth);
  flWheel.position.set(wheelX, wheelY, frontWheelZ);
  const frWheel = createWheel(wheelRadius, wheelWidth);
  frWheel.position.set(-wheelX, wheelY, frontWheelZ);
  const rlWheel = createWheel(wheelRadius, wheelWidth);
  rlWheel.position.set(wheelX, wheelY, rearWheelZ);
  const rrWheel = createWheel(wheelRadius, wheelWidth);
  rrWheel.position.set(-wheelX, wheelY, rearWheelZ);

  carGroup.add(flWheel, frWheel, rlWheel, rrWheel);
  wheelMeshes.push(flWheel, frWheel, rlWheel, rrWheel);

  return {
    group: carGroup,
    wheelMeshes,
    frontLeftWheel: flWheel,
    frontRightWheel: frWheel,
    headlights,
    taillights,
    exhaustPoints,
    engineBayPoint,
    bodyMaterials,
    classType,
  };
}
