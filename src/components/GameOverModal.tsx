import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { MatchStats } from '../types/game';
import { Trophy, Skull, RotateCcw, Award, Flame, ShieldAlert, ArrowLeft } from 'lucide-react';

interface GameOverModalProps {
  stats: MatchStats;
  onRestart: () => void;
  onBackToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ stats, onRestart, onBackToMenu }) => {
  useEffect(() => {
    if (stats.isVictory) {
      // Trigger victory confetti burst
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#06b6d4', '#ef4444', '#10b981'],
        });
      } catch {
        // Safe fail
      }
    }
  }, [stats.isVictory]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
      <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col items-center text-center animate-takedown-slam">
        {/* Result Icon */}
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-xl ${
            stats.isVictory
              ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/30'
              : 'bg-gradient-to-tr from-rose-600 to-red-800 text-white shadow-rose-600/30'
          }`}
        >
          {stats.isVictory ? <Trophy className="w-10 h-10" /> : <Skull className="w-10 h-10" />}
        </div>

        {/* Title */}
        <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider text-white">
          {stats.isVictory ? 'VITÓRIA TOTAL!' : 'VEÍCULO DESTRUÍDO'}
        </h2>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-1">
          {stats.isVictory ? 'ÚLTIMO SOBREVIVENTE DA ARENA ZERO' : 'VOCÊ NÃO RESISTIU AO IMPACTO'}
        </p>

        {/* Placement Badge */}
        <div className="my-5 px-5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-black text-slate-200 uppercase">
            CLASSIFICAÇÃO: <span className="text-amber-400">{stats.placement}º LUGAR</span>
          </span>
        </div>

        {/* Match Statistics Grid */}
        <div className="w-full grid grid-cols-3 gap-3 my-2">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" /> TAKEDOWNS
            </span>
            <span className="text-2xl font-black italic text-amber-400 mt-1">
              {stats.totalTakedowns}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" /> DANO TOTAL
            </span>
            <span className="text-2xl font-black italic text-white mt-1">
              {stats.totalDamage}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              TEMPO VIVO
            </span>
            <span className="text-lg font-black italic text-slate-200 mt-1">
              {formatTime(stats.survivalTimeSec)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={onRestart}
            className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:via-orange-400 hover:to-red-500 text-slate-950 font-black text-base uppercase italic tracking-wider shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="w-5 h-5" />
            JOGAR NOVAMENTE
          </button>

          <button
            onClick={onBackToMenu}
            className="py-4 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <ArrowLeft className="w-4 h-4" />
            MUDAR CARRO
          </button>
        </div>
      </div>
    </div>
  );
};
