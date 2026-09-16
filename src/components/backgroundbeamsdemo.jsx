"use client";
import React from "react";

export function BackgroundBeamsDemo() {
  return (
    <div className="absolute inset-0 w-full h-full bg-[#050408] overflow-hidden pointer-events-none z-0">
      {/* Animated Vertical Radar Scanline Beam */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(20,52,251,0.08)_50%,transparent_100%)] bg-[length:200%_100%] animate-[radarScan_4s_linear_infinite]" />

      {/* Diagonal Grid Beam Streaks */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,rgba(255,234,0,0.15)_0%,transparent_70%)]" />
      
      <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gridBeam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1434FB" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFEA00" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF2A2A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="-100%" y1="0" x2="200%" y2="100%" stroke="url(#gridBeam)" strokeWidth="1.5" className="animate-[pulse_2s_ease-in-out_infinite]" />
        <line x1="200%" y1="0" x2="-100%" y2="100%" stroke="url(#gridBeam)" strokeWidth="1" className="animate-[pulse_3s_ease-in-out_infinite]" />
      </svg>

      <style>{`
        @keyframes radarScan {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}