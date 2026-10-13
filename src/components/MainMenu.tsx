import React, { useState } from 'react';
import { VehicleClassType, VEHICLE_CLASSES } from '../types/game';
import { soundManager } from '../game/sound';
import { Shield, Zap, Gauge, Flame, Volume2, VolumeX, Play, HelpCircle, Crosshair } from 'lucide-react';

interface MainMenuProps {
  onStartGame: (selectedClass: VehicleClassType, customColor: string) => void;
  onCarPreview?: (selectedClass: VehicleClassType, customColor: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Laranja Furioso', hex: '#f97316' },
  { name: 'Ciano Neon', hex: '#06b6d4' },
  { name: 'Vermelho Sangue', hex: '#dc2626' },
  { name: 'Amarelo Ácido', hex: '#eab308' },
  { name: 'Roxo Elétrico', hex: '#9333ea' },
  { name: 'Verde Veneno', hex: '#10b981' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onCarPreview }) => {
  const [selectedClass, setSelectedClass] = useState<VehicleClassType>('BRAWLER');
  const [selectedColor, setSelectedColor] = useState<string>('#f97316');
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const [showControls, setShowControls] = useState<boolean>(false);

  const toggleSound = () => {
    const next = !isMuted;
    soundManager.setMuted(next);
    setIsMuted(next);
  };

  const handleSelectClass = (c: VehicleClassType) => {
    setSelectedClass(c);
    const color = VEHICLE_CLASSES[c].color;
    setSelectedColor(color);
    onCarPreview?.(c, color);
  };

  const handleSelectColor = (hex: string) => {
    setSelectedColor(hex);
    onCarPreview?.(selectedClass, hex);
  };

  const currentConfig = VEHICLE_CLASSES[selectedClass];

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between p-6 sm:p-10 bg-radial from-slate-900/90 via-slate-950/95 to-black text-white select-none backdrop-blur-sm overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-3 h-10 bg-amber-500 rounded-sm skew-x-[-12deg]" />
          <div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-wider uppercase italic text-glow-orange text-amber-500">
              ÚLTIMO MOTOR
            </h1>
            <p className="text-xs sm:text-sm font-semibold tracking-widest text-slate-400 uppercase">
              Motor Royale • Arena Zero
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowControls(!showControls)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 transition"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Controles</span>
          </button>
          <button
            onClick={toggleSound}
            className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-200 transition"
            title="Alternar Som"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-6xl mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Class Selection Cards */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-amber-500" />
              Escolha Sua Máquina de Combate
            </h2>
            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
              3 Classes Disponíveis
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['INTERCEPTOR', 'BRAWLER', 'BRUISER'] as VehicleClassType[]).map((cType) => {
              const cfg = VEHICLE_CLASSES[cType];
              const isSelected = selectedClass === cType;

              return (
                <button
                  key={cType}
                  onClick={() => handleSelectClass(cType)}
                  className={`relative p-4 rounded-xl text-left border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-800/90 border-amber-500 shadow-lg shadow-amber-500/20 translate-y-[-2px]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                  <div>
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${cfg.color}25`,
                        color: cfg.color,
                        border: `1px solid ${cfg.color}50`,
                      }}
                    >
                      {cfg.subtitle}
                    </span>
                    <h3 className="text-xl font-black italic tracking-wide mt-2 text-white">
                      {cfg.name}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                      {cfg.maxSpeed} km/h
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      {cfg.armor} HP
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Selected Vehicle Stats */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-2xl font-black italic uppercase text-white flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block"
                    style={{ backgroundColor: selectedColor }}
                  />
                  {currentConfig.name}
                  <span className="text-xs font-normal text-slate-400 not-italic">
                    ({currentConfig.mass} kg)
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
                  {currentConfig.description}
                </p>
              </div>

              {/* Color Preset Palette */}
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">Cor:</span>
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    onClick={() => handleSelectColor(preset.hex)}
                    style={{ backgroundColor: preset.hex }}
                    className={`w-6 h-6 rounded-full transition transform hover:scale-110 border-2 ${
                      selectedColor === preset.hex ? 'border-white scale-110 shadow-md' : 'border-black/40'
                    }`}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            {/* Spec Progress Bars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-cyan-400" /> VELOCIDADE
                  </span>
                  <span>{currentConfig.maxSpeed}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${(currentConfig.maxSpeed / 200) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> ACELERAÇÃO
                  </span>
                  <span>{currentConfig.acceleration}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${(currentConfig.acceleration / 30) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" /> BLINDAGEM
                  </span>
                  <span>{currentConfig.armor} HP</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${(currentConfig.armor / 160) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-rose-500" /> MASSA
                  </span>
                  <span>{currentConfig.mass} kg</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${(currentConfig.mass / 2400) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Rules & Play Button */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900/80 to-slate-900/90 border border-amber-500/30 box-glow-orange flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-widest text-amber-400 uppercase">
                MODO DE JOGO
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                ÚLTIMO SOBREVIVENTE
              </span>
            </div>

            <h3 className="text-xl font-black italic text-white uppercase">
              Dirija. Arme-se. Sobreviva.
            </h3>

            <ul className="text-xs text-slate-300 space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">▶</span>
                <span>
                  <strong>6 veículos entram na arena:</strong> Você contra 5 adversários agressivos. Não há corrida de chegada!
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">▶</span>
                <span>
                  <strong>Armas e power-ups:</strong> Atravesse pickups dourados e use <strong>E</strong> para lançar foguetes, minas, energia ou ativar seu item. Um slot, sem mira com mouse.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">▶</span>
                <span>
                  <strong>Zona progressiva:</strong> Observe o temporizador e o anel amarelo da próxima área. Colisões são secundárias; o último veículo sobrevivente vence.
                </span>
              </li>
            </ul>

            <button
              onClick={() => onStartGame(selectedClass, selectedColor)}
              className="mt-3 w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:via-orange-400 hover:to-red-500 text-slate-950 font-black text-lg sm:text-xl tracking-wider uppercase italic shadow-xl shadow-orange-500/30 transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
            >
              <Play className="w-6 h-6 fill-slate-950" />
              ENTRAR NA ARENA
            </button>
          </div>
        </div>
      </div>

      {/* Controls Overlay Modal if toggled */}
      {showControls && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                Controles do Veículo
              </h3>
              <button
                onClick={() => setShowControls(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Acelerar</span>
                <span className="font-mono font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded">W / ↑</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Frear / Marcha à Ré</span>
                <span className="font-mono font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded">S / ↓</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Virar Direção</span>
                <span className="font-mono font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded">A / D ou ← / →</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Freio de Mão / Drift (Gera Turbo)</span>
                <span className="font-mono font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded">Espaço</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Turbo Nitro</span>
                <span className="font-mono font-bold text-cyan-400 bg-slate-800 px-2 py-0.5 rounded">Shift</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Usar Arma / Power-up</span>
                <span className="font-mono font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded">E</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Alternar Câmera (Perto / Longe / Capô)</span>
                <span className="font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">C</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Pausar Partida</span>
                <span className="font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">P ou Esc</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Reiniciar Rápido</span>
                <span className="font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">R</span>
              </div>
            </div>

            <button
              onClick={() => setShowControls(false)}
              className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs uppercase"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 border-t border-slate-800/80 pt-4">
        <span>Protótipo 3D jogável executado diretamente no navegador via WebGL & Cannon Physics</span>
        <span className="text-slate-400 font-medium">Inspirado em Burnout 3: Takedown & Mario Kart</span>
      </div>
    </div>
  );
};
