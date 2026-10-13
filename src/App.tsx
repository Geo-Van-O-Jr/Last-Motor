/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { MainMenu } from './components/MainMenu';
import { GameHUD } from './components/GameHUD';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import {
  VehicleClassType,
  VehicleState,
  GameStatus,
  TakedownEvent,
  MatchStats,
} from './types/game';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameStatus, setGameStatus] = useState<GameStatus>('menu');
  const [selectedClass, setSelectedClass] = useState<VehicleClassType>('BRAWLER');
  const [selectedColor, setSelectedColor] = useState<string>('#f97316');

  // Match State from engine
  const [playerState, setPlayerState] = useState<VehicleState | null>(null);
  const [survivorsCount, setSurvivorsCount] = useState<number>(6);
  const [matchTime, setMatchTime] = useState<number>(0);
  const [zoneRadius, setZoneRadius] = useState<number>(85);
  const [allVehicles, setAllVehicles] = useState<VehicleState[]>([]);
  const [cameraMode, setCameraMode] = useState<string>('PERTO');

  // Events & Modals
  const [takedownBanner, setTakedownBanner] = useState<{
    title: string;
    subtitle: string;
    isPlayer: boolean;
  } | null>(null);
  const [combatLogs, setCombatLogs] = useState<TakedownEvent[]>([]);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);

  const bannerTimeoutRef = useRef<number | null>(null);

  // Initialize GameEngine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine(containerRef.current, {
      onStateUpdate: (state) => {
        setPlayerState(state.player);
        setSurvivorsCount(state.survivors);
        setMatchTime(state.matchTime);
        setZoneRadius(state.zoneRadius);
        setAllVehicles(state.allVehicles);
      },
      onTakedownBanner: (banner) => {
        setTakedownBanner(banner);
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = window.setTimeout(() => {
          setTakedownBanner(null);
        }, 2200);
      },
      onCombatLog: (log) => {
        setCombatLogs((prev) => [...prev.slice(-4), log]);
      },
      onMatchEnd: (stats) => {
        setMatchStats(stats);
        setGameStatus('gameover');
      },
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Keyboard shortcut listener for Pause and Quick Restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus === 'playing') {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          handlePause();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          handleRestart();
        } else if (e.code === 'KeyC') {
          // Camera mode cycle display
          setCameraMode((prev) => {
            if (prev === 'PERTO') return 'LONGE';
            if (prev === 'LONGE') return 'CAPÔ';
            return 'PERTO';
          });
        }
      } else if (gameStatus === 'paused') {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          handleResume();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          handleRestart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, selectedClass, selectedColor]);

  const handleStartGame = useCallback((carClass: VehicleClassType, carColor: string) => {
    setSelectedClass(carClass);
    setSelectedColor(carColor);
    setCombatLogs([]);
    setTakedownBanner(null);
    setGameStatus('playing');

    if (engineRef.current) {
      engineRef.current.startMatch(carClass, carColor);
    }
  }, []);

  const handleRestart = useCallback(() => {
    setCombatLogs([]);
    setTakedownBanner(null);
    setGameStatus('playing');

    if (engineRef.current) {
      engineRef.current.startMatch(selectedClass, selectedColor);
    }
  }, [selectedClass, selectedColor]);

  const handlePause = useCallback(() => {
    setGameStatus('paused');
    if (engineRef.current) {
      engineRef.current.setPaused(true);
    }
  }, []);

  const handleResume = useCallback(() => {
    setGameStatus('playing');
    if (engineRef.current) {
      engineRef.current.setPaused(false);
    }
  }, []);

  const handleCarPreview = useCallback((carClass: VehicleClassType, carColor: string) => {
    setSelectedClass(carClass);
    setSelectedColor(carColor);
    engineRef.current?.updateShowroom(carClass, carColor);
  }, []);

  const handleVirtualInput = useCallback((key: 'throttle' | 'steer', value: number) => {
    engineRef.current?.setVirtualInput(key, value);
  }, []);

  const handleVirtualButton = useCallback((key: 'drift' | 'boost', active: boolean) => {
    engineRef.current?.setVirtualButton(key, active);
  }, []);

  const handleBackToMenu = useCallback(() => {
    setGameStatus('menu');
    if (engineRef.current) {
      engineRef.current.cleanup();
      engineRef.current.updateShowroom(selectedClass, selectedColor);
    }
  }, [selectedClass, selectedColor]);

  return (
    <div
      onClick={() => window.focus()}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none"
    >
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 z-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Main Menu Modal */}
      {gameStatus === 'menu' && (
        <MainMenu onStartGame={handleStartGame} onCarPreview={handleCarPreview} />
      )}

      {/* In-Game Heads-Up Display */}
      {(gameStatus === 'playing' || gameStatus === 'paused') && (
        <GameHUD
          playerState={playerState}
          survivorsCount={survivorsCount}
          totalVehiclesCount={6}
          matchTimeSec={matchTime}
          zoneRadius={zoneRadius}
          allVehicles={allVehicles}
          takedownBanner={takedownBanner}
          combatLogs={combatLogs}
          cameraMode={cameraMode}
          onVirtualInput={handleVirtualInput}
          onVirtualButton={handleVirtualButton}
        />
      )}

      {/* Pause Modal */}
      {gameStatus === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onBackToMenu={handleBackToMenu}
        />
      )}

      {/* Game Over / Victory Modal */}
      {gameStatus === 'gameover' && matchStats && (
        <GameOverModal
          stats={matchStats}
          onRestart={handleRestart}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </div>
  );
}
