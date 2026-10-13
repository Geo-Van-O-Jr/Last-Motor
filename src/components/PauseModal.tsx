import React, { useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, ArrowLeft, Gamepad2 } from 'lucide-react';
import { soundManager } from '../game/sound';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart, onBackToMenu }) => {
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  const toggleSound = () => {
    const next = !isMuted;
    soundManager.setMuted(next);
    setIsMuted(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col gap-5 text-center">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-wider text-white">
            JOGO PAUSADO
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">
            ÚLTIMO MOTOR • ARENA ZERO
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base uppercase italic tracking-wider flex items-center justify-center gap-2 cursor-pointer transition shadow-lg shadow-amber-500/20"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            CONTINUAR PARTIDA
          </button>

          <button
            onClick={onRestart}
            className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <RotateCcw className="w-4 h-4" />
            REINICIAR PARTIDA [R]
          </button>

          <button
            onClick={toggleSound}
            className="py-3 px-6 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            {isMuted ? 'ATIVAR ÁUDIO' : 'SILENCIAR ÁUDIO'}
          </button>

          <button
            onClick={onBackToMenu}
            className="py-3 px-6 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <ArrowLeft className="w-4 h-4" />
            VOLTAR AO MENU PRINCIPAL
          </button>
        </div>

        {/* Mini Controls Reminder */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold">
            <Gamepad2 className="w-4 h-4 text-amber-400" /> CONTROLES:
          </span>
          <span>W/A/S/D • Espaço (Drift) • Shift (Nitro) • C (Câmera)</span>
        </div>
      </div>
    </div>
  );
};
