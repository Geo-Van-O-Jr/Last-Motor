import type { VehiclePhysicsEntity } from './physicsEngine';
import { ROYALE_CONFIG } from './royaleConfig';

export type DamageSource = 'weapons' | 'environment' | 'collisions';
export interface DamageEvent {
  victim: VehiclePhysicsEntity;
  attacker?: VehiclePhysicsEntity;
  source: DamageSource;
  damage: number;
  deadly: boolean;
  label: string;
}

export class DamageSystem {
  public totals = { weapons: 0, environment: 0, collisions: 0 };
  constructor(private onDamage: (event: DamageEvent) => void = () => {}) {}

  public apply(victim: VehiclePhysicsEntity, amount: number, source: DamageSource, now: number, attacker?: VehiclePhysicsEntity, label = 'ZONA') {
    if (victim.state.isDead || amount <= 0) return 0;
    const shield = victim.state.shieldTime > 0 ? 1 - ROYALE_CONFIG.items.shieldReduction : 1;
    const damage = Math.min(victim.state.hp, amount * ROYALE_CONFIG.damageScale[source] * shield);
    victim.state.hp = Math.max(0, victim.state.hp - damage);
    victim.state.lastHitBy = attacker?.id;
    victim.state.lastHitTime = now;
    this.totals[source] += damage;
    if (attacker && attacker !== victim) attacker.state.damageDealt += damage;
    const deadly = victim.state.hp <= 0;
    if (deadly) {
      victim.state.isDead = true;
      // Wrecks remain visible but cannot block surviving drivers or projectiles.
      victim.body.collisionResponse = false;
      victim.forwardSpeed = 0;
      victim.lateralSpeed = 0;
      victim.body.velocity.set(0, 0, 0);
      victim.state.isBoosting = victim.state.isDrifting = false;
      if (attacker && attacker !== victim) attacker.state.takedowns++;
    }
    this.onDamage({ victim, attacker, source, damage, deadly, label });
    return damage;
  }
  public reset() { this.totals = { weapons: 0, environment: 0, collisions: 0 }; }
}
