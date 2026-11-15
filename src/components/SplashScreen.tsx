import React, { useEffect, useState } from 'react';
import { SpytifyBrandLogo } from './Icons';

interface SplashScreenProps {
  onFinish: () => void;
  themeMode?: 'dark' | 'light';
  accentColor?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  themeMode,
  accentColor,
}) => {
  const effectiveTheme =
    themeMode || ((localStorage.getItem('spytify_theme_mode') as 'dark' | 'light') || 'dark');
  const effectiveAccent =
    accentColor || localStorage.getItem('spytify_accent_color') || '#ff2a55';
  const isLight = effectiveTheme === 'light';

  const [fadeout, setFadeout] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setFadeout(true);
    }, 400);

    const t2 = setTimeout(() => {
      onFinish();
    }, 650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        backgroundColor: isLight ? '#ffffff' : '#09090d',
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none transition-all duration-300 ease-out ${
        fadeout ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <style>{`
        @keyframes spytifyDiscordPulse {
          0%, 100% { transform: scale(1) translateY(0px); }
          50% { transform: scale(1.08) translateY(-4px); }
        }
      `}</style>

      {/* Minimalist Discord-style centered breathing logo */}
      <div
        style={{
          animation: 'spytifyDiscordPulse 1.2s ease-in-out infinite',
        }}
        className="relative flex flex-col items-center justify-center"
      >
        <SpytifyBrandLogo
          accentColor={effectiveAccent}
          themeMode={effectiveTheme}
          className="w-24 h-24 rounded-3xl"
        />
      </div>

      {/* Simple clean brand name below */}
      <h1
        style={{
          color: isLight ? '#0f172a' : '#ffffff',
        }}
        className="mt-3 text-lg font-extrabold tracking-widest uppercase"
      >
        Spytify
      </h1>
    </div>
  );
};
