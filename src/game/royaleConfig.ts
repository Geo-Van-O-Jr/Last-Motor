import type { ItemType } from '../types/game';

// Gameplay targets, not guaranteed proportions: measured in DamageSystem.totals.
export const ROYALE_CONFIG = {
  damageTargets: { weapons: 0.75, environment: 0.15, collisions: 0.10 },
  damageScale: { weapons: 1, environment: 0.6, collisions: 0.6 },
  environment: { barrelDamage: 25, barrelRadius: 9 },
  collision: { harmlessBelowKmh: 50, maxDamage: 6, cooldownSec: 3, maxImpulseMs: 3 },
  rocket: { damage: 38, speed: 62, turnRate: 1.35, lockRange: 48, lockCone: 0.85, life: 3.5 },
  energy: { damage: 22, speed: 105, life: 1.8 },
  mine: { damage: 52, armSec: 0.7, life: 24, triggerRadius: 3, blastRadius: 7 },
  items: { cooldownSec: 0.45, respawnSec: 9, shieldSec: 6, shieldReduction: 0.65, repair: 35, turboSec: 8, turboCapacity: 160, doubleAmmoSec: 18 },
  // Final diameter 84m leaves room for sustained high-speed arcs.
  zone: [
    { radius: 70, wait: 30, close: 20, damage: 3 },
    { radius: 55, wait: 22, close: 20, damage: 5 },
    { radius: 42, wait: 18, close: 22, damage: 8 },
  ],
  finalZoneDamage: 11,
  pickupWeights: { ROCKET: 28, MINE: 20, ENERGY: 27, SHIELD: 9, REPAIR: 8, TURBO: 5, DOUBLE_AMMO: 3 } satisfies Record<ItemType, number>,
};

export const ITEM_INFO: Record<ItemType, { name: string; symbol: string; color: string; hint: string }> = {
  ROCKET: { name: 'Foguete rastreador', symbol: '↗', color: '#fb923c', hint: 'Trava à frente em até 48m; obstáculos cortam o rastreio.' },
  MINE: { name: 'Mina explosiva', symbol: '✹', color: '#f43f5e', hint: 'Solta atrás; arma em 0,7s. Ideal contra perseguidores.' },
  ENERGY: { name: 'Projétil de energia', symbol: 'ϟ', color: '#22d3ee', hint: 'Disparo frontal rápido, sem rastreamento.' },
  SHIELD: { name: 'Escudo temporário', symbol: '◇', color: '#818cf8', hint: 'Reduz dano em 65% por 6s.' },
  REPAIR: { name: 'Reparo', symbol: '+', color: '#34d399', hint: 'Recupera até 35 de integridade.' },
  TURBO: { name: 'Sobrecarga de turbo', symbol: '»', color: '#facc15', hint: 'Reserva de nitro aumenta por 8s.' },
  DOUBLE_AMMO: { name: 'Munição dupla', symbol: '×2', color: '#e879f9', hint: 'Ative e colete uma arma: dois disparos. Bônus dura 18s.' },
};
