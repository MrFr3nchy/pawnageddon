import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene.js';
import { TitleScene } from '../scenes/TitleScene.js';
import { GameScene } from '../scenes/GameScene.js';

export function PhaserGame({ onGameReady }) {
  const containerRef = useRef(null);
  const gameRef      = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;

    const dpr = window.devicePixelRatio || 1;
    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundColor: '#0f0f13',
      transparent: true,
      antialias: true,
      antialiasGL: true,
      resolution: dpr,
      scene: [BootScene, TitleScene, GameScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameRef.current = new Phaser.Game(config);

    const handler = (e) => onGameReady?.(e.detail);
    window.addEventListener('gameReady', handler);

    return () => {
      window.removeEventListener('gameReady', handler);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
