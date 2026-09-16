import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Zap, Sun, Battery, Car, AlertOctagon, Terminal, ChevronDown } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { ChromaticImageDemo } from './components/chromaticimage';
import { BackgroundBeamsDemo } from './components/BackgroundBeamsDemo';

const WEBSOCKET_MODE = false;
const WS_URL = 'ws://localhost:8000/ws';

export default function App() {
  const [crisisStep, setCrisisStep] = useState('IDLE');
  const [time, setTime] = useState('');
  const [activeNode, setActiveNode] = useState('GRID');

  const heroRef = useRef(null);
  const { scrollYProgress: heroScrollY } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroScale = useTransform(heroScrollY, [0, 1], [1, 0.9]);
  const heroOpacity = useTransform(heroScrollY, [0, 0.6], [1, 0]);

  const [evList, setEvList] = useState([
    { id: 'VAN-ALPHA', priority: 'HIGH', soc: 42, draw: 50, status: 'CHARGING' },
    { id: 'VAN-BRAVO', priority: 'HIGH', soc: 38, draw: 50, status: 'CHARGING' },
    { id: 'VAN-CHARLIE', priority: 'LOW', soc: 89, draw: 0, status: 'STANDBY' },
    { id: 'VAN-DELTA', priority: 'LOW', soc: 94, draw: 0, status: 'STANDBY' }
  ]);

  const [telemetry, setTelemetry] = useState({
    solar: 180,
    ev: 100,
    bess: 0,
    bessSoc: 98,
    factory: 200,
  });

  const [load, setLoad] = useState(320);
  const [history, setHistory] = useState(Array(30).fill({ load: 320, threshold: 425, solar: 180, ev: 100, bessSoc: 98 }));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric", fractionalSecondDigits: 2 }).replace(':', ':')), 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (WEBSOCKET_MODE) {
      const ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if(data.telemetry) setTelemetry(data.telemetry);
        if(data.evList) setEvList(data.evList);
        if(data.load) setLoad(data.load);
        if(data.crisisStep) setCrisisStep(data.crisisStep);
      };
      return () => ws.close();
    }

    const tick = setInterval(() => {
      const jitterSolar = telemetry.solar > 50 ? telemetry.solar + (Math.random() * 4 - 2) : telemetry.solar;
      const jitterEv = telemetry.ev > 50 ? telemetry.ev + (Math.random() * 4 - 2) : telemetry.ev;
      const currentLoad = telemetry.factory + jitterEv - jitterSolar - telemetry.bess;

      setLoad(Math.round(currentLoad));
      setHistory(prev => {
        const newHistory = [...prev, { load: Math.round(currentLoad), threshold: 425, solar: Math.round(jitterSolar), ev: Math.round(jitterEv), bessSoc: telemetry.bessSoc }];
        return newHistory.slice(-30);
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [telemetry]);

  const triggerCrisis = () => {
    if(crisisStep !== 'IDLE' || WEBSOCKET_MODE) return;
    setCrisisStep('SURGE');
    setTelemetry(prev => ({ ...prev, solar: 40, ev: 280 }));
    setEvList([
      { id: 'VAN-ALPHA', priority: 'HIGH', soc: 43, draw: 70, status: 'CHARGING' },
      { id: 'VAN-BRAVO', priority: 'HIGH', soc: 39, draw: 70, status: 'CHARGING' },
      { id: 'VAN-CHARLIE', priority: 'LOW', soc: 89, draw: 70, status: 'CHARGING' },
      { id: 'VAN-DELTA', priority: 'LOW', soc: 94, draw: 70, status: 'CHARGING' }
    ]);

    setTimeout(() => {
      setCrisisStep('INTERVENTION');
      setTelemetry(prev => ({ ...prev, ev: 190, bess: 65, bessSoc: 92 }));
      setEvList([
        { id: 'VAN-ALPHA', priority: 'HIGH', soc: 44, draw: 95, status: 'CHARGING' },
        { id: 'VAN-BRAVO', priority: 'HIGH', soc: 40, draw: 95, status: 'CHARGING' },
        { id: 'VAN-CHARLIE', priority: 'LOW', soc: 89, draw: 0, status: 'THROTTLED' },
        { id: 'VAN-DELTA', priority: 'LOW', soc: 94, draw: 0, status: 'THROTTLED' }
      ]);
      setTimeout(() => setCrisisStep('STABILIZED'), 1500);
    }, 2000);
  };

  const reset = () => {
    if (WEBSOCKET_MODE) return;
    setCrisisStep('IDLE');
    setActiveNode('GRID');
    setTelemetry({ solar: 180, ev: 100, bess: 0, bessSoc: 98, factory: 200 });
    setEvList([
      { id: 'VAN-ALPHA', priority: 'HIGH', soc: 42, draw: 50, status: 'CHARGING' },
      { id: 'VAN-BRAVO', priority: 'HIGH', soc: 38, draw: 50, status: 'CHARGING' },
      { id: 'VAN-CHARLIE', priority: 'LOW', soc: 89, draw: 0, status: 'STANDBY' },
      { id: 'VAN-DELTA', priority: 'LOW', soc: 94, draw: 0, status: 'STANDBY' }
    ]);
  };

  const isCritical = load > 410;

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if(el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const renderSparkline = (dataKey, color) => (
    <div className="w-16 h-8 opacity-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <YAxis domain={['auto', 'auto']} hide />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderDataTable = () => {
    if (activeNode === 'EV') {
      return evList.map(ev => (
        <div key={ev.id} className={`border-r border-white/20 p-4 flex flex-col justify-between transition-colors ${ev.status === 'THROTTLED' ? 'bg-[#FF2A2A] text-white' : 'hover:bg-[#1434FB] hover:text-white'}`}>
          <span className="font-mono text-[9px] tracking-widest opacity-60 font-bold">{ev.id} // {ev.priority}</span>
          <div className="flex justify-between items-end mt-4">
            <span className="text-2xl font-black font-mono">{ev.draw}<span className="text-xs ml-1">kW</span></span>
            <span className="font-mono text-[9px] font-bold opacity-80 uppercase">{ev.status} ({ev.soc}%)</span>
          </div>
        </div>
      ));
    }
    return (
      <>
        <div className="border-r border-white/20 p-4 flex flex-col justify-between transition-colors group relative overflow-hidden">
          <span className="font-mono text-[9px] tracking-widest text-white/50 font-bold">SOLAR_GEN</span>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-black font-mono text-[#FFEA00]">{history[history.length-1].solar}<span className="text-xs ml-1">kW</span></span>
            {renderSparkline('solar', '#FFEA00')}
          </div>
        </div>
        <div className="border-r border-white/20 p-4 flex flex-col justify-between transition-colors group relative overflow-hidden">
          <span className="font-mono text-[9px] tracking-widest text-white/50 font-bold">EV_FLEET</span>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-black font-mono text-[#1434FB]">{history[history.length-1].ev}<span className="text-xs ml-1">kW</span></span>
            {renderSparkline('ev', '#1434FB')}
          </div>
        </div>
        <div className="border-r border-white/20 p-4 flex flex-col justify-between transition-colors group relative overflow-hidden">
          <span className="font-mono text-[9px] tracking-widest text-white/50 font-bold">BESS_SOC</span>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-black font-mono text-[#FF2A2A]">{history[history.length-1].bessSoc}<span className="text-xs ml-1">%</span></span>
            {renderSparkline('bessSoc', '#FF2A2A')}
          </div>
        </div>
        <div className="p-4 flex flex-col justify-between transition-colors group relative overflow-hidden">
          <span className="font-mono text-[9px] tracking-widest text-white/50 font-bold">FAC_BASE</span>
          <span className="text-2xl font-black font-mono text-white">200<span className="text-xs ml-1 opacity-50">kW</span></span>
        </div>
      </>
    );
  };

  return (
    <>
      <style>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-block; white-space: nowrap; animation: scroll 15s linear infinite; }
        .brutalist-grid { background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 40px 40px; }
        html { scroll-behavior: smooth; cursor: auto !important; }
        body, div, span, button, a, section { cursor: auto; }
        button, a { cursor: pointer !important; }
      `}</style>

      <div className="min-h-screen bg-[#06020c] text-[#F7F7F2] font-sans selection:bg-[#FFEA00] selection:text-black flex flex-col brutalist-grid">

        {/* TOP TICKER TAPE - ACID YELLOW */}
        <div className="border-b-2 border-black py-2 overflow-hidden flex whitespace-nowrap text-[11px] font-mono tracking-[0.2em] uppercase bg-[#FFEA00] text-black font-black sticky top-0 z-50">
          <div className="animate-marquee">
            <span className="mx-4">/// WATT THE GRID // AUTONOMOUS SYSTEM</span>
            <span className="mx-4">/// SYSTEM NOMINAL</span>
            <span className="mx-4">/// LAT: 34.0522 N LNG: 118.2437 W</span>
            <span className="mx-4">/// WATT THE GRID // AUTONOMOUS SYSTEM</span>
            <span className="mx-4">/// SYSTEM NOMINAL</span>
            <span className="mx-4">/// LAT: 34.0522 N LNG: 118.2437 W</span>
          </div>
        </div>

        {/* SECTION 1: HERO WITH CHROMATIC POWER STATION BACKGROUND */}
        <div ref={heroRef} className="relative min-h-screen overflow-hidden group">
          <ChromaticImageDemo />

          <motion.section
            style={{ scale: heroScale, opacity: heroOpacity }}
            className="min-h-screen w-full flex flex-col justify-between border-b-2 border-white/20 p-8 lg:p-16 relative z-10"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#1434FB]/15 to-transparent pointer-events-none z-10" />
            <div className="flex justify-between items-center font-mono text-xs text-white/60 uppercase relative z-20">
              <span>[ SYSTEM.INIT // 2026 ]</span>
              <span>UTC {time}</span>
            </div>

            <div className="my-auto relative z-20 py-8">
              <div className="max-w-4xl">
                <div className="inline-block bg-[#1434FB] text-white font-mono text-xs px-4 py-1.5 mb-6 uppercase tracking-widest font-bold border border-white/25 shadow-lg">
                  Autonomous Microgrid Intelligence Engine
                </div>
                <h1 className="text-[clamp(4.5rem,10vw,12rem)] font-bold leading-[0.8] tracking-tight mb-8">
                  Watt<br/>The<br/>
                  <span className="text-[#FFEA00] font-['Pacifico'] normal-case font-normal tracking-normal">
                    Grid
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-white/20 pt-6 relative z-20">
              <button onClick={() => scrollToSection('command-center')} className="font-mono text-xs text-[#FFEA00] uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors">
                <ChevronDown className="w-5 h-5 animate-bounce" /> [ LAUNCH COMMAND CENTER ]
              </button>
              <div className="font-mono text-xs text-white/40 uppercase">
                STATUS: SECURE // 0.00ms LATENCY
              </div>
            </div>
          </motion.section>
        </div>

        {/* SECTION 2: CORE COMMAND CENTER */}
        <section id="command-center" className="min-h-screen grid grid-cols-1 lg:grid-cols-12 border-b-2 border-white/25 bg-[#06020c] relative">
          <div className="col-span-5 border-r border-white/20 flex flex-col justify-between bg-[#1434FB] text-white p-8 lg:p-12 relative overflow-hidden">
            {/* Halftone Dot Matrix Texture Overlay */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
              style={{
                backgroundImage: 'radial-gradient(circle, #ffffff 1.5px, transparent 1.5px)',
                backgroundSize: '16px 16px'
              }}
            />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-12">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                  <Zap className="text-[#1434FB] w-6 h-6 animate-pulse" />
                </div>
                <div className="text-right font-mono text-xs text-white/70 leading-tight">
                  [ LIVE_NODE ]<br/>UTC {time}
                </div>
              </div>

              <h2 className="text-[clamp(5rem,9vw,9.5rem)] font-['Anton'] leading-[0.75] tracking-tighter uppercase mb-6 w-full">
                COMMAND<br/>
                <span className="text-[#FFEA00] font-['Pacifico'] normal-case font-normal tracking-normal text-[clamp(4rem,7.5vw,8rem)] inline-block mt-2">
                  Console
                </span>
              </h2>

              <p className="font-mono text-xs tracking-widest text-white/80 leading-relaxed uppercase max-w-[320px]">
                Real-time threat detection active. Sub-second execution logic enabled for transformer overload prevention.
              </p>
            </div>

            <div className="space-y-6 relative z-10">
              <button onClick={() => scrollToSection('diagnostics')} className="flex items-center gap-2 font-mono text-xs text-[#FFEA00] hover:text-white transition-colors">
                <ChevronDown className="w-4 h-4 animate-bounce" /> [ VIEW TOPOLOGY DIAGNOSTICS ]
              </button>
              <div className="grid grid-cols-2 border border-white/20 bg-[#06020c]">
                <button onClick={triggerCrisis} className={`group flex flex-col justify-between p-6 h-32 border-r border-white/20 transition-colors ${crisisStep !== 'IDLE' ? 'bg-[#FF2A2A] text-white opacity-50 cursor-not-allowed' : 'bg-[#FF2A2A] text-white hover:bg-white hover:text-[#FF2A2A]'}`}>
                  <AlertOctagon className="w-6 h-6 mb-4 transition-transform group-hover:scale-110" />
                  <span className="font-mono text-[10px] tracking-widest uppercase font-black text-left">SIMULATE<br/>CRISIS</span>
                </button>
                <button onClick={reset} className="group flex flex-col justify-between p-6 h-32 transition-colors bg-[#06020c] text-white hover:bg-[#FFEA00] hover:text-black">
                  <ArrowUpRight className="w-6 h-6 mb-4 transition-transform group-hover:rotate-45" />
                  <span className="font-mono text-[10px] tracking-widest uppercase font-black text-left">RESET<br/>BASELINE</span>
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-7 flex flex-col justify-between relative overflow-hidden">
            {/* BACKGROUND BEAMS LAYER */}
            <BackgroundBeamsDemo />

            <div className={`flex-grow flex flex-col justify-center relative z-10 p-8 lg:p-12 transition-colors duration-500 ${isCritical ? 'bg-[#FF2A2A]/20' : 'bg-transparent'}`}>
              <div className="absolute top-6 left-6 font-mono text-xs tracking-widest text-white/50 uppercase flex gap-4">
                <span>[ TX-400 MAIN BUS LOAD ]</span>
                {WEBSOCKET_MODE && <span className="text-[#FFEA00] animate-pulse">WS CONNECTED</span>}
              </div>

              <div className="flex items-start justify-center mt-8">
                <span className={`text-[clamp(8rem,14vw,16rem)] font-['Anton'] tracking-tighter leading-none transition-all duration-300 ${isCritical ? 'text-[#FF2A2A]' : 'text-white'}`}>
                  {load}
                </span>
                <span className="text-2xl font-mono text-[#1434FB] mt-8 ml-2 font-bold">kW</span>
              </div>

              <div className="w-full h-32 mt-6 opacity-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <YAxis domain={[0, 500]} hide />
                    <Area type="stepAfter" dataKey="load" stroke={isCritical ? '#FF2A2A' : '#FFEA00'} strokeWidth={3} fill="transparent" isAnimationActive={false} />
                    <Area type="monotone" dataKey="threshold" stroke="#ffffff" strokeDasharray="3 3" strokeWidth={1} fill="transparent" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full mt-6 px-2">
                <div className="flex justify-between font-mono text-[10px] text-white/50 mb-2 font-bold">
                  <span>0 kW</span>
                  <span className="text-[#FF2A2A] animate-pulse">THRESHOLD: 425 kW</span>
                  <span>500 kW MAX</span>
                </div>
                <div className="h-3 w-full bg-white/10 rounded-none overflow-hidden border border-white/20">
                  <div className={`h-full transition-all duration-700 ease-out ${isCritical ? 'bg-[#FF2A2A]' : 'bg-[#FFEA00]'}`} style={{ width: `${(load / 500) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 border-t border-white/20 h-32 bg-[#06020c] relative z-10">
              {renderDataTable()}
            </div>
          </div>
        </section>

        {/* SECTION 3: TOPOLOGY & EVENT LOG (VIBRANT GRADIENT MESH BACKGROUND) */}
        <section id="diagnostics" className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-gradient-to-br from-[#06020c] via-[#0b0c24] to-[#04020a] p-6 lg:p-12 gap-6 items-start relative overflow-hidden">
          {/* CRT Scanline Overlay Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 z-10" />

          {/* Topology Panel */}
          <div className="lg:col-span-6 border-2 border-white/30 flex flex-col bg-[#0c0a1d]/90 backdrop-blur-md relative z-20 shadow-[0_0_40px_rgba(20,52,251,0.2)]" style={{ minHeight: '560px' }}>
            <div className="flex justify-between font-mono text-xs tracking-widest text-white/80 uppercase font-bold p-6 border-b-2 border-white/20 bg-white/5">
              <span>[ TOPOLOGY_DIAGNOSTIC_MAP ]</span>
              <span className="text-[#FFEA00] animate-pulse">TARGET: {activeNode}</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-6 relative">
              <svg viewBox="0 0 400 340" width="100%" style={{ maxWidth: 420, display: 'block' }}>
                <line x1="200" y1="0" x2="200" y2="340" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                <line x1="0" y1="170" x2="400" y2="170" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                <line x1="200" y1="170" x2="200" y2="64" stroke="rgba(255,234,0,0.4)" strokeWidth="1.5" strokeDasharray="5,4" />
                <line x1="200" y1="170" x2="290" y2="170" stroke="rgba(20,52,251,0.5)" strokeWidth="1.5" strokeDasharray="5,4" />
                <line x1="200" y1="170" x2="200" y2="278" stroke="rgba(255,42,42,0.4)" strokeWidth="1.5" strokeDasharray="5,4" />
                <line x1="200" y1="170" x2="110" y2="170" stroke="rgba(247,247,242,0.2)" strokeWidth="1.5" strokeDasharray="5,4" />

                <g onClick={() => setActiveNode('SOLAR')} style={{ cursor: 'pointer' }}>
                  <rect x="128" y="20" width="144" height="44" fill={activeNode === 'SOLAR' ? '#FFEA00' : '#06020c'} stroke="#FFEA00" strokeWidth={activeNode === 'SOLAR' ? 2.5 : 1.5} style={{ filter: 'drop-shadow(0 0 8px rgba(255,234,0,0.5))' }} />
                  <text x="200" y="38" textAnchor="middle" fill={activeNode === 'SOLAR' ? '#000' : '#FFEA00'} fontFamily="monospace" fontSize="9" fontWeight="bold">SOLAR_GEN</text>
                  <text x="200" y="54" textAnchor="middle" fill={activeNode === 'SOLAR' ? '#000' : '#FFEA00'} fontFamily="monospace" fontSize="10" fontWeight="900">{telemetry.solar} kW</text>
                </g>

                <g onClick={() => setActiveNode('EV')} style={{ cursor: 'pointer' }}>
                  <rect x="290" y="144" width="100" height="52" fill={activeNode === 'EV' ? '#1434FB' : '#06020c'} stroke="#1434FB" strokeWidth={activeNode === 'EV' ? 2.5 : 1.5} style={{ filter: 'drop-shadow(0 0 8px rgba(20,52,251,0.5))' }} />
                  <text x="340" y="163" textAnchor="middle" fill={activeNode === 'EV' ? '#fff' : '#1434FB'} fontFamily="monospace" fontSize="8" fontWeight="bold">EV_FLEET</text>
                  <text x="340" y="181" textAnchor="middle" fill={activeNode === 'EV' ? '#fff' : '#1434FB'} fontFamily="monospace" fontSize="10" fontWeight="900">{telemetry.ev} kW</text>
                </g>

                <g onClick={() => setActiveNode('BESS')} style={{ cursor: 'pointer' }}>
                  <rect x="128" y="278" width="144" height="44" fill={activeNode === 'BESS' ? '#FF2A2A' : '#06020c'} stroke="#FF2A2A" strokeWidth={activeNode === 'BESS' ? 2.5 : 1.5} style={{ filter: 'drop-shadow(0 0 8px rgba(255,42,42,0.5))' }} />
                  <text x="200" y="296" textAnchor="middle" fill={activeNode === 'BESS' ? '#fff' : '#FF2A2A'} fontFamily="monospace" fontSize="9" fontWeight="bold">BESS_SOC</text>
                  <text x="200" y="312" textAnchor="middle" fill={activeNode === 'BESS' ? '#fff' : '#FF2A2A'} fontFamily="monospace" fontSize="10" fontWeight="900">{telemetry.bessSoc}%</text>
                </g>

                <g>
                  <rect x="10" y="144" width="100" height="52" fill="#06020c" stroke="rgba(247,247,242,0.3)" strokeWidth="1.5" />
                  <text x="60" y="163" textAnchor="middle" fill="rgba(247,247,242,0.5)" fontFamily="monospace" fontSize="8" fontWeight="bold">FACTORY</text>
                  <text x="60" y="181" textAnchor="middle" fill="rgba(247,247,242,0.5)" fontFamily="monospace" fontSize="10" fontWeight="900">200 kW</text>
                </g>

                <g onClick={() => setActiveNode('GRID')} style={{ cursor: 'pointer' }}>
                  <rect x="150" y="143" width="100" height="54"
                    fill={isCritical ? 'rgba(255,42,42,0.35)' : activeNode === 'GRID' ? '#FFEA00' : '#06020c'}
                    stroke={isCritical ? '#FF2A2A' : '#ffffff'}
                    strokeWidth={activeNode === 'GRID' || isCritical ? 3 : 1.5}
                    style={{ filter: isCritical ? 'drop-shadow(0 0 12px rgba(255,42,42,0.8))' : activeNode === 'GRID' ? 'drop-shadow(0 0 10px rgba(255,234,0,0.6))' : 'none' }}
                  />
                  <text x="200" y="163" textAnchor="middle" fill={activeNode === 'GRID' && !isCritical ? '#000' : '#fff'} fontFamily="monospace" fontSize="8" fontWeight="bold">TX-400</text>
                  <text x="200" y="177" textAnchor="middle" fill={activeNode === 'GRID' && !isCritical ? '#000' : '#fff'} fontFamily="monospace" fontSize="7" fontWeight="bold">MAIN BUS</text>
                  <text x="200" y="190" textAnchor="middle" fill={activeNode === 'GRID' && !isCritical ? '#000' : isCritical ? '#FF2A2A' : '#FFEA00'} fontFamily="monospace" fontSize="9" fontWeight="900">{load} kW</text>
                </g>
              </svg>
            </div>
            <div className="font-mono text-[10px] text-white/40 uppercase px-6 pb-4 border-t border-white/10 pt-3">Click nodes to route diagnostics to the main data deck.</div>
          </div>

          {/* Event Log Panel */}
          <div className="lg:col-span-6 border-2 border-white/30 flex flex-col bg-[#0c0a1d]/90 backdrop-blur-md relative z-20 shadow-[0_0_40px_rgba(20,52,251,0.2)]" style={{ minHeight: '560px' }}>
            <div className="flex justify-between items-center p-6 border-b-2 border-white/20 bg-white/5">
              <span className="font-mono text-xs tracking-widest text-white/70 uppercase font-bold">[ SYSTEM_LOG // EVENT_STREAM ]</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FFEA00] animate-ping" />
                <Terminal className="w-5 h-5 text-[#FFEA00]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 font-mono text-xs leading-loose uppercase font-bold bg-[#06020c]">
              <div className="flex flex-col gap-3">
                <p className="text-white/50 flex gap-4"><span className="text-white/30 shrink-0">--:--:--</span><span>SYSTEM STANDBY — DAEMON ACTIVE</span></p>
                <p className="text-white/40 flex gap-4"><span className="text-white/30 shrink-0">--:--:--</span><span>MONITORING TX-400 MAIN BUS — LOAD WITHIN SAFE BAND</span></p>
                <p className="text-white/40 flex gap-4"><span className="text-white/30 shrink-0">--:--:--</span><span>SOLAR ARRAY NOMINAL — OUTPUT {telemetry.solar} kW</span></p>
                <p className="text-white/40 flex gap-4"><span className="text-white/30 shrink-0">--:--:--</span><span>EV FLEET CONNECTED — DRAW {telemetry.ev} kW</span></p>
                {crisisStep !== 'IDLE' && (
                  <p className="text-[#FF2A2A] flex gap-4 bg-[#FF2A2A]/10 p-1"><span className="shrink-0">+0.00ms</span><span>SURGE DETECTED — CLOUD COVER + EV SPIKE</span></p>
                )}
                {(crisisStep === 'INTERVENTION' || crisisStep === 'STABILIZED') && (
                  <>
                    <p className="text-[#FFEA00] flex gap-4 bg-[#FFEA00]/10 p-1"><span className="shrink-0">+2.00ms</span><span>THROTTLING LOW-PRIORITY EVs: VAN-CHARLIE, VAN-DELTA</span></p>
                    <p className="text-[#1434FB] bg-[#1434FB]/20 text-white flex gap-4 p-1"><span className="shrink-0">+2.05ms</span><span>P2P ROUTE ESTABLISHED — BESS-01 TO EV-DEPOT</span></p>
                  </>
                )}
                {crisisStep === 'STABILIZED' && (
                  <p className="text-[#FFEA00] flex gap-4 p-1"><span className="shrink-0">+3.50ms</span><span>GRID BALANCED AND STABILIZED // CAPACITY SAFE</span></p>
                )}
              </div>
            </div>
            <div className="font-mono text-[10px] text-white/40 uppercase px-6 py-3 border-t border-white/10 flex justify-between items-center">
              <span>Sub-second autonomous event tracking operational.</span>
              <span className="text-[#FFEA00] animate-pulse">&gt;_ READY</span>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}