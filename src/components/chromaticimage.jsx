import React from 'react';
import powerStationImg from '../assets/powerstation.png';

export function ChromaticImageDemo() {
  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <img
        src={powerStationImg}
        alt="Riverdale Municipal Power Station Substation"
        className="w-full h-full object-cover filter brightness-75 contrast-125 transition-transform duration-700 group-hover:scale-105"
      />

      {/* Dark scrim so text stays readable over the photo */}
      <div className="absolute inset-0 bg-[#09070D]/70" />

      {/* Chromatic Aberration RGB Shift Effect on Hover */}
      <div
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none mix-blend-screen opacity-0 group-hover:opacity-100 transform -translate-x-2 translate-y-1 filter hue-rotate-90 contrast-150"
        style={{
          backgroundImage: `url(${powerStationImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none mix-blend-screen opacity-0 group-hover:opacity-100 transform translate-x-2 -translate-y-1 filter hue-rotate-180 contrast-150"
        style={{
          backgroundImage: `url(${powerStationImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Brutalist HUD Overlay Tag */}
      <div className="absolute bottom-6 right-6 bg-black/90 border border-white/30 px-3 py-1.5 font-mono text-[10px] text-[#FFEA00] uppercase tracking-widest backdrop-blur-md">
        [ SUBSTATION FEED // LIVE OPTICS (ACTIVE) ]
      </div>
    </div>
  );
}
