import { ROYALE_CONFIG } from './royaleConfig';
import type { ZoneState } from '../types/game';

export class ZoneSystem {
  public getState(time: number): ZoneState {
    let start = 0;
    let previous = 85;
    for (const [index, phase] of ROYALE_CONFIG.zone.entries()) {
      const closeStart = start + phase.wait;
      const end = closeStart + phase.close;
      if (time < end) {
        const closing = time >= closeStart;
        const fraction = closing ? (time - closeStart) / phase.close : 0;
        return { phase: index + 1, status: closing ? 'closing' : 'waiting', radius: previous + (phase.radius - previous) * fraction,
          nextRadius: phase.radius, secondsRemaining: Math.ceil((closing ? end : closeStart) - time), damagePerSec: phase.damage };
      }
      previous = phase.radius;
      start = end;
    }
    return { phase: ROYALE_CONFIG.zone.length, status: 'final', radius: previous, nextRadius: previous, secondsRemaining: 0, damagePerSec: ROYALE_CONFIG.finalZoneDamage };
  }
}
