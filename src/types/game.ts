export type VehicleClassType = 'INTERCEPTOR' | 'BRAWLER' | 'BRUISER';

export interface VehicleClassConfig {
  id: VehicleClassType;
  name: string;
  subtitle: string;
  description: string;
  maxSpeed: number; // km/h
  acceleration: number;
  handling: number;
  armor: number; // Max HP
  ramPower: number; // Damage multiplier
  mass: number; // kg in physics
  color: string;
  secondaryColor: string;
  accentColor: string;
  width: number;
  height: number;
  length: number;
}

export const VEHICLE_CLASSES: Record<VehicleClassType, VehicleClassConfig> = {
  INTERCEPTOR: {
    id: 'INTERCEPTOR',
    name: 'Interceptor',
    subtitle: 'Ágil & Letal',
    description: 'Pequeno, esportivo e veloz. Aceleração absurda e curvas afiadas. Ideal para posicionar disparos e escapar de foguetes.',
    maxSpeed: 195,
    acceleration: 28,
    handling: 3.4,
    armor: 85,
    ramPower: 1.15,
    mass: 1100,
    color: '#06b6d4', // Cyan
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    width: 1.9,
    height: 1.1,
    length: 4.2,
  },
  BRAWLER: {
    id: 'BRAWLER',
    name: 'Brawler',
    subtitle: 'Equilíbrio & Força',
    description: 'Muscle car icônico com para-choques reforçados. O equilíbrio perfeito entre velocidade de ponta, peso e resistência.',
    maxSpeed: 175,
    acceleration: 24,
    handling: 2.8,
    armor: 110,
    ramPower: 1.4,
    mass: 1450,
    color: '#f97316', // Orange
    secondaryColor: '#18181b',
    accentColor: '#fbbf24',
    width: 2.1,
    height: 1.25,
    length: 4.6,
  },
  BRUISER: {
    id: 'BRUISER',
    name: 'Bruiser',
    subtitle: 'Fortaleza Móvel',
    description: 'Veículo blindado pesado e intimidador. Blindagem colossal para resistir ao combate e controlar a área com minas.',
    maxSpeed: 150,
    acceleration: 20,
    handling: 2.1,
    armor: 150,
    ramPower: 1.9,
    mass: 2200,
    color: '#dc2626', // Crimson red
    secondaryColor: '#171717',
    accentColor: '#facc15',
    width: 2.4,
    height: 1.5,
    length: 5.1,
  },
};

export type AIArchetype = 'aggressive' | 'opportunist' | 'defensive';

export type WeaponType = 'ROCKET' | 'MINE' | 'ENERGY';
export type ItemType = WeaponType | 'SHIELD' | 'REPAIR' | 'TURBO' | 'DOUBLE_AMMO';
export interface EquippedItem { type: ItemType; ammo: number }
export interface ZoneState {
  phase: number;
  status: 'waiting' | 'closing' | 'final';
  radius: number;
  nextRadius: number;
  secondsRemaining: number;
  damagePerSec: number;
}

export interface VehicleState {
  id: string;
  name: string;
  isPlayer: boolean;
  classType: VehicleClassType;
  hp: number;
  maxHp: number;
  boost: number;
  maxBoost: number;
  isDead: boolean;
  takedowns: number;
  damageDealt: number;
  speedKmh: number;
  isBoosting: boolean;
  isDrifting: boolean;
  driftAngle: number;
  lastHitBy?: string;
  lastHitTime: number;
  aiBehavior?: AIArchetype;
  color: string;
  position: { x: number; y: number; z: number };
  heading: number; // yaw angle in rad
  item: EquippedItem | null;
  itemCooldown: number;
  itemAcquired: number;
  shieldTime: number;
  turboTime: number;
  doubleAmmoTime: number;
  rocketThreats: number;
  lockTargetName: string | null;
}

export type TakedownType = 'TAKEDOWN' | 'RAM' | 'SIDE_SLAM' | 'ENVIRONMENTAL';

export interface TakedownEvent {
  id: string;
  victimName: string;
  attackerName: string;
  isPlayerInvolved: boolean;
  type: TakedownType;
  message: string;
  timestamp: number;
}

export interface MatchStats {
  placement: number;
  totalTakedowns: number;
  totalDamage: number;
  survivalTimeSec: number;
  isVictory: boolean;
}

export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover';
export type CameraMode = 'close' | 'far' | 'hood';
