import React from 'react';
import type { VehicleState } from '../types/game';
import { ITEM_INFO } from '../game/royaleConfig';

export function ItemHUD({ player, onUse }: { player: VehicleState | null; onUse?: () => void }) {
  const item = player?.item;
  const info = item ? ITEM_INFO[item.type] : null;
  return (
    <div className="self-center w-full max-w-xs pointer-events-auto">
      <button type="button" onClick={onUse} disabled={!item || (player?.itemCooldown ?? 0) > 0}
        aria-label={info ? `Usar ${info.name}` : 'Colete um item'}
        className="w-full text-left p-3 rounded-2xl bg-slate-950/90 border border-amber-500/40 backdrop-blur-md shadow-xl disabled:cursor-default cursor-pointer hover:border-amber-400 transition">
        <div key={player?.itemAcquired ?? 0} className={item ? 'animate-item-acquired flex items-center gap-3' : 'flex items-center gap-3'}>
          <span style={{ color: info?.color ?? '#64748b' }} className="text-3xl font-black w-10 text-center">{info?.symbol ?? '?'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">SLOT DE ITEM • ATIVAR [E]</div>
            <div style={{ color: info?.color ?? '#e2e8f0' }} className="text-xs font-black uppercase">{info?.name ?? 'Atravesse um pickup dourado'}</div>
            <div className="text-[10px] text-slate-300 mt-1">{info?.hint ?? 'Armas e power-ups espalhados pela arena.'}</div>
          </div>
          {item && <span className="font-mono font-black text-lg text-white" aria-label={`${item.ammo} carga(s)`}>×{item.ammo}</span>}
        </div>
        {(player?.itemCooldown ?? 0) > 0 && <div className="text-[9px] text-amber-300 mt-1">RECARREGANDO…</div>}
      </button>
      {player?.lockTargetName && <div className="text-center text-[10px] text-orange-300 font-black mt-1">ALVO TRAVADO: {player.lockTargetName}</div>}
      {(player?.doubleAmmoTime ?? 0) > 0 && <div className="text-center text-[10px] text-fuchsia-300 font-bold">PRÓXIMA ARMA ×2 • {Math.ceil(player!.doubleAmmoTime)}s</div>}
      {(player?.turboTime ?? 0) > 0 && <div className="text-center text-[10px] text-yellow-300 font-bold">SOBRECARGA • {Math.ceil(player!.turboTime)}s</div>}
    </div>
  );
}
