import React, { useEffect, useRef } from 'react';
import { VehicleState, TakedownEvent, ZoneState } from '../types/game';
import { ItemHUD } from './ItemHUD';
import { Shield, Zap, Flame, Skull, Clock, AlertTriangle, Compass, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface GameHUDProps {
  playerState: VehicleState | null;
  survivorsCount: number;
  totalVehiclesCount: number;
  matchTimeSec: number;
  zoneRadius: number;
  zoneState: ZoneState | null;
  allVehicles: VehicleState[];
  takedownBanner: { title: string; subtitle: string; isPlayer: boolean } | null;
  combatLogs: TakedownEvent[];
  cameraMode: string;
  onVirtualInput?: (key: 'throttle' | 'steer', value: number) => void;
  onVirtualButton?: (key: 'drift' | 'boost', active: boolean) => void;
  onUseItem?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  playerState,
  survivorsCount,
  totalVehiclesCount,
  matchTimeSec,
  zoneRadius,
  zoneState,
  allVehicles,
  takedownBanner,
  combatLogs,
  cameraMode,
  onVirtualInput,
  onVirtualButton,
  onUseItem,
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Radar Canvas
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const scale = (size / 2 - 8) / 85; // arena radius is 85

    ctx.clearRect(0, 0, size, size);

    // Radar background circle
    ctx.beginPath();
    ctx.arc(center, center, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
    ctx.beginPath();
    ctx.moveTo(center, 4);
    ctx.lineTo(center, size - 4);
    ctx.moveTo(4, center);
    ctx.lineTo(size - 4, center);
    ctx.stroke();

    // Shrinking Electric Zone Ring
    const zonePixelRadius = zoneRadius * scale;
    ctx.beginPath();
    ctx.arc(center, center, zonePixelRadius, 0, Math.PI * 2);
    ctx.strokeStyle = zoneRadius < 35 ? 'rgba(239, 68, 68, 0.95)' : 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (zoneState && zoneState.status !== 'final') {
      ctx.beginPath();
      ctx.arc(center, center, zoneState.nextRadius * scale, 0, Math.PI * 2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#facc15';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw vehicles
    allVehicles.forEach((v) => {
      if (v.isDead) return;

      const px = center + v.position.x * scale;
      const py = center + v.position.z * scale;

      ctx.save();
      ctx.translate(px, py);

      if (v.isPlayer) {
        // Player: vibrant green arrowhead pointing in heading direction
        ctx.rotate(-v.heading);
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(4, -4);
        ctx.lineTo(-4, -4);
        ctx.closePath();
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Bot: colored dot
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = v.color || '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    });
  }, [allVehicles, zoneRadius, zoneState?.nextRadius, zoneState?.status]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hp = playerState ? Math.max(0, Math.round(playerState.hp)) : 0;
  const maxHp = playerState ? playerState.maxHp : 100;
  const hpRatio = hp / maxHp;

  const boost = playerState ? Math.round(playerState.boost) : 0;
  const speed = playerState ? playerState.speedKmh : 0;
  const takedowns = playerState ? playerState.takedowns : 0;

  let hpColor = 'from-emerald-500 to-green-600';
  let hpBorder = 'border-emerald-500/30';
  let hpStatusText = 'INTEGRIDADE EXCELENTE';

  if (hpRatio < 0.25) {
    hpColor = 'from-rose-600 to-red-700 animate-pulse-fast';
    hpBorder = 'border-rose-500/50 box-glow-red';
    hpStatusText = 'ESTADO CRÍTICO — RISCO IMINENTE!';
  } else if (hpRatio < 0.6) {
    hpColor = 'from-amber-500 to-orange-600';
    hpBorder = 'border-amber-500/30';
    hpStatusText = 'ESTRUTURA DANIFICADA';
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none flex flex-col justify-between p-3 sm:p-6 overflow-hidden">
      {/* TOP BAR */}
      <div className="flex items-start justify-between w-full pointer-events-auto">
        {/* Top-Left: Radar & Zone Status */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative p-1 rounded-2xl bg-slate-950/85 border border-slate-700/80 backdrop-blur-md shadow-xl">
            <canvas ref={radarCanvasRef} width={90} height={90} className="rounded-xl block" />
            <div className="absolute bottom-1 right-1.5 text-[8px] font-bold font-mono text-cyan-400">
              RADAR
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/85 border border-slate-800 backdrop-blur-md text-xs font-bold text-slate-200">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-white text-sm">{formatTime(matchTimeSec)}</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl backdrop-blur-md text-xs font-bold border ${
                zoneRadius < 35
                  ? 'bg-rose-950/85 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-slate-950/85 border-cyan-800/60 text-cyan-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>ZONA: {zoneRadius}m</span>
            </div>
            <div className="text-[10px] font-black text-amber-300 bg-slate-950/85 rounded-lg px-2 py-1">
              {zoneState?.status === 'final' ? 'CONFRONTO FINAL' : `FASE ${zoneState?.phase ?? 1} • ${zoneState?.status === 'closing' ? 'FECHANDO' : 'FECHA EM'} ${zoneState?.secondsRemaining ?? 30}s`}
              {zoneState?.status !== 'final' && <div className="text-[8px] text-slate-300">PRÓXIMA ÁREA: {zoneState?.nextRadius ?? 70}m • ANEL AMARELO</div>}
            </div>
          </div>
        </div>

        {/* Top-Center: Survivors Count */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="px-5 py-1.5 rounded-b-xl bg-slate-950/90 border-b border-x border-amber-500/40 backdrop-blur-md flex items-center gap-3 shadow-lg">
            <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
              MOTOR ROYALE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase italic">
              <Skull className="w-3.5 h-3.5 text-rose-400" />
              <span>
                {survivorsCount} / {totalVehiclesCount} SOBREVIVENTES
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right: Kill Feed / Combat Logs */}
        <div className="flex flex-col items-end gap-1.5 max-w-[220px] sm:max-w-xs">
          <div className="sm:hidden text-[10px] font-black text-white">{survivorsCount}/{totalVehiclesCount} SOBREVIVENTES</div>
          <div className="px-3 py-1 rounded-xl bg-slate-950/90 border border-amber-500/50 backdrop-blur-md flex items-center gap-2 shadow-lg mb-1">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black text-amber-400 tracking-wide uppercase italic">
              {takedowns} {takedowns === 1 ? 'TAKEDOWN' : 'TAKEDOWNS'}
            </span>
          </div>

          <div className="flex flex-col gap-1 items-end w-full">
            {combatLogs.slice(-3).map((log) => (
              <div
                key={log.id}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-md border ${
                  log.isPlayerInvolved
                    ? 'bg-amber-950/90 text-amber-200 border-amber-500/60 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700/60'
                }`}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>

      {(playerState?.rocketThreats ?? 0) > 0 && (
        <div role="alert" className="absolute top-36 sm:top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-rose-950/95 border border-rose-500 text-rose-200 font-black text-xs animate-pulse">
          ⚠ FOGUETE A CAMINHO • CURVE OU USE COBERTURA
        </div>
      )}

      {/* CENTER: TAKEDOWN BANNER POPUP */}
      {takedownBanner && (
        <div className="self-center my-auto flex flex-col items-center justify-center animate-takedown-slam pointer-events-none">
          <div
            className={`px-8 py-3 rounded-2xl border-2 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center ${
              takedownBanner.isPlayer
                ? 'bg-gradient-to-r from-amber-600/90 via-orange-600/95 to-red-600/90 border-amber-300 shadow-orange-500/60'
                : 'bg-slate-900/95 border-slate-500 text-slate-200'
            }`}
          >
            <h2 className="text-2xl sm:text-4xl font-black italic tracking-wider uppercase text-white drop-shadow-md">
              {takedownBanner.title}
            </h2>
            <p className="text-xs font-bold text-amber-100 uppercase tracking-widest mt-1">
              {takedownBanner.subtitle}
            </p>
          </div>
        </div>
      )}

      {/* BOTTOM AREA: GAUGES & OPTIONAL ON-SCREEN CONTROLS */}
      <div className="flex flex-col gap-2 w-full">
        <ItemHUD player={playerState} onUse={onUseItem} />
        <div className="flex flex-wrap items-end justify-between gap-2 w-full">
          {/* Bottom-Left: Health & Boost Gauges */}
          <div className="flex flex-col gap-2 flex-1 max-w-[220px] sm:max-w-xs pointer-events-auto">
            {/* Health Gauge */}
            <div className={`p-2.5 sm:p-3 rounded-2xl bg-slate-950/85 border ${hpBorder} backdrop-blur-md shadow-2xl`}>
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-black uppercase mb-1">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  BLINDAGEM
                </span>
                <span className="font-mono text-white text-xs sm:text-sm">
                  {hp} <span className="text-[10px] text-slate-400">/ {maxHp}</span>
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${hpColor} transition-all duration-200`}
                  style={{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }}
                />
              </div>

              <div className="mt-1 text-[8px] sm:text-[9px] font-bold text-slate-400 tracking-wider">
                {hpStatusText}
              </div>
              {(playerState?.shieldTime ?? 0) > 0 && <div className="text-[10px] font-black text-indigo-300 mt-1">◇ ESCUDO • {Math.ceil(playerState!.shieldTime)}s • −65% DANO</div>}
            </div>

            {/* Nitro Turbo Gauge */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-950/85 border border-cyan-500/30 backdrop-blur-md shadow-2xl">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-black uppercase mb-1">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Zap className="w-3.5 h-3.5" />
                  TURBO NITRO
                </span>
                <span className="font-mono text-cyan-300 text-xs sm:text-sm">
                  {boost}%
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-cyan-900/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-100 shadow-sm shadow-cyan-400"
                  style={{ width: `${Math.min(100, boost / (playerState?.maxBoost ?? 100) * 100)}%` }}
                />
              </div>

              <div className="mt-1 flex items-center justify-between text-[8px] sm:text-[9px] font-bold text-slate-400">
                <span>[SHIFT]</span>
                <span className="text-cyan-400 font-semibold">DRIFT = +TURBO</span>
              </div>
            </div>
          </div>

          {/* Bottom-Center: On-Screen Touch / Click Driving Buttons */}
          <div className="order-3 sm:order-none w-full sm:w-auto pointer-events-auto flex flex-wrap justify-center items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800/80 backdrop-blur-md shadow-2xl">
            {/* Steering Left / Right */}
            <div className="flex items-center gap-1.5">
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onVirtualInput?.('steer', -1); }}
                onPointerUp={() => onVirtualInput?.('steer', 0)}
                onPointerCancel={() => onVirtualInput?.('steer', 0)}
                onLostPointerCapture={() => onVirtualInput?.('steer', 0)}
                className="touch-none w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white flex items-center justify-center font-bold border border-slate-700 shadow-md cursor-pointer transition select-none"
                title="Virar à Esquerda (A / ←)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onVirtualInput?.('steer', 1); }}
                onPointerUp={() => onVirtualInput?.('steer', 0)}
                onPointerCancel={() => onVirtualInput?.('steer', 0)}
                onLostPointerCapture={() => onVirtualInput?.('steer', 0)}
                className="touch-none w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white flex items-center justify-center font-bold border border-slate-700 shadow-md cursor-pointer transition select-none"
                title="Virar à Direita (D / →)"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Throttle / Brake */}
            <div className="flex items-center gap-1.5">
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onVirtualInput?.('throttle', 1); }}
                onPointerUp={() => onVirtualInput?.('throttle', 0)}
                onPointerCancel={() => onVirtualInput?.('throttle', 0)}
                onLostPointerCapture={() => onVirtualInput?.('throttle', 0)}
                className="touch-none w-10 h-10 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 active:bg-emerald-500 text-white flex items-center justify-center font-bold border border-emerald-600 shadow-md cursor-pointer transition select-none"
                title="Acelerar (W / ↑)"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onVirtualInput?.('throttle', -1); }}
                onPointerUp={() => onVirtualInput?.('throttle', 0)}
                onPointerCancel={() => onVirtualInput?.('throttle', 0)}
                onLostPointerCapture={() => onVirtualInput?.('throttle', 0)}
                className="touch-none w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-rose-600 text-white flex items-center justify-center font-bold border border-slate-700 shadow-md cursor-pointer transition select-none"
                title="Frear / Ré (S / ↓)"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
            </div>

            {/* Drift & Boost Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onVirtualButton?.('drift', true); }}
                onPointerUp={() => onVirtualButton?.('drift', false)}
                onPointerCancel={() => onVirtualButton?.('drift', false)}
                onLostPointerCapture={() => onVirtualButton?.('drift', false)}
                className="touch-none px-2.5 h-10 rounded-xl bg-amber-600/80 hover:bg-amber-500 active:bg-amber-400 text-white text-xs font-black uppercase border border-amber-500 shadow-md cursor-pointer transition select-none flex items-center gap-1"
                title="Drift (Espaço)"
              >
                <Flame className="w-3.5 h-3.5" />
                DRIFT
              </button>
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onVirtualButton?.('boost', true); }}
                onPointerUp={() => onVirtualButton?.('boost', false)}
                onPointerCancel={() => onVirtualButton?.('boost', false)}
                onLostPointerCapture={() => onVirtualButton?.('boost', false)}
                className="touch-none px-2.5 h-10 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 active:bg-cyan-400 text-white text-xs font-black uppercase border border-cyan-400 shadow-md cursor-pointer transition select-none flex items-center gap-1"
                title="Turbo Nitro (Shift)"
              >
                <Zap className="w-3.5 h-3.5" />
                NITRO
              </button>
            </div>
          </div>

          {/* Bottom-Right: Speedometer */}
          <div className="flex flex-col items-end gap-2 pointer-events-auto">
            <div className="flex flex-col items-end gap-1">
              {playerState?.isBoosting && (
                <div className="px-2.5 py-0.5 rounded-lg bg-cyan-500 text-slate-950 font-black text-[10px] uppercase tracking-wider italic shadow-lg shadow-cyan-500/40 animate-pulse">
                  ⚡ NITRO ATIVO!
                </div>
              )}
              {playerState?.isDrifting && (
                <div className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider italic shadow-lg shadow-amber-500/40">
                  🔥 DRIFTING!
                </div>
              )}
            </div>

            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/90 border border-slate-700/80 backdrop-blur-md shadow-2xl flex flex-col items-end min-w-[120px] sm:min-w-[140px]">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-400" />
                VELOCIDADE
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-3xl sm:text-4xl font-black italic text-white tracking-tight">
                  {speed}
                </span>
                <span className="text-[10px] font-bold text-amber-500">KM/H</span>
              </div>

              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, (speed / 200) * 100)}%` }}
                />
              </div>

              <div className="text-[8px] font-medium text-slate-400 mt-1.5">
                CÂMERA: <span className="font-bold text-white uppercase">{cameraMode} [C]</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
