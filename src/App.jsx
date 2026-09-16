import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Zap, Sun, Battery, Car, AlertOctagon, Terminal, ChevronDown } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const WEBSOCKET_MODE = false;
const WS_URL = 'ws://localhost:8000/ws';

export default function App() {
  const [crisisStep, setCrisisStep] = useState('IDLE');
  const [time, setTime] = useState('');
  const [activeNode, setActiveNode] = useState('GRID');

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
        <div onClick={() => setActiveNode(activeNode === 'SOLAR' ? 'GRID' : 'SOLAR')} className={`border-r border-white/20 p-4 flex flex-col justify-between transition-all cursor-pointer group relative overflow-hidden ${activeNode === 'SOLAR' ? 'bg-[#FFEA00]/15' : 'hover:bg-[#FFEA00]/10'}`}>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] tracking-widest text-white/60 font-bold group-hover:text-[#FFEA00]">SOLAR_GEN</span>
            <span className="font-mono text-[8px] text-[#FFEA00] font-semibold">96.4%</span>
          </div>
          <div className="flex justify-between items-end mt-2">
            <span className="text-2xl font-black font-mono text-[#FFEA00]">{history[history.length-1].solar}<span className="text-xs ml-1">kW</span></span>
            {renderSparkline('solar', '#FFEA00')}
          </div>
        </div>
        <div onClick={() => setActiveNode(activeNode === 'EV' ? 'GRID' : 'EV')} className={`border-r border-white/20 p-4 flex flex-col justify-between transition-all cursor-pointer group relative overflow-hidden ${activeNode === 'EV' ? 'bg-[#1434FB]/20' : 'hover:bg-[#1434FB]/15'}`}>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] tracking-widest text-white/60 font-bold group-hover:text-[#1434FB]">EV_FLEET</span>
            <span className="font-mono text-[8px] text-[#1434FB] font-semibold">04 UNITS</span>
          </div>
          <div className="flex justify-between items-end mt-2">
            <span className="text-2xl font-black font-mono text-[#1434FB]">{history[history.length-1].ev}<span className="text-xs ml-1">kW</span></span>
            {renderSparkline('ev', '#1434FB')}
          </div>
        </div>
        <div onClick={() => setActiveNode(activeNode === 'BESS' ? 'GRID' : 'BESS')} className={`border-r border-white/20 p-4 flex flex-col justify-between transition-all cursor-pointer group relative overflow-hidden ${activeNode === 'BESS' ? 'bg-[#FF2A2A]/20' : 'hover:bg-[#FF2A2A]/15'}`}>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] tracking-widest text-white/60 font-bold group-hover:text-[#FF2A2A]">BESS_SOC</span>
            <span className="font-mono text-[8px] text-[#FF2A2A] font-semibold">LFP CELL</span>
          </div>
          <div className="flex justify-between items-end mt-2">
            <span className="text-2xl font-black font-mono text-[#FF2A2A]">{history[history.length-1].bessSoc}<span className="text-xs ml-1">%</span></span>
            {renderSparkline('bessSoc', '#FF2A2A')}
          </div>
        </div>
        <div className="p-4 flex flex-col justify-between transition-colors group relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] tracking-widest text-white/50 font-bold">FAC_BASE</span>
            <span className="font-mono text-[8px] text-white/50 font-semibold">60.0 Hz</span>
          </div>
          <div className="flex justify-between items-end mt-2">
            <span className="text-2xl font-black font-mono text-white">200<span className="text-xs ml-1 opacity-50">kW</span></span>
            <div className="flex items-end gap-1 h-5 pb-0.5 opacity-70">
              <span className="w-1 bg-white/40 h-2 animate-pulse" />
              <span className="w-1 bg-white/80 h-4 animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 bg-white/60 h-3 animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      <style>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes dash { to { stroke-dashoffset: -12; } }
        .animate-marquee { display: inline-block; white-space: nowrap; animation: scroll 15s linear infinite; }
        .brutalist-grid { background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 40px 40px; }
        html { scroll-behavior: smooth; }
      `}</style>

      <div className="min-h-screen bg-[#09070D] text-[#F7F7F2] font-sans selection:bg-[#FFEA00] selection:text-black flex flex-col brutalist-grid">
        
        {/* TOP TICKER TAPE - ACID YELLOW */}
        <div className="border-b-2 border-black py-2 overflow-hidden flex whitespace-nowrap text-[11px] font-mono tracking-[0.2em] uppercase bg-[#FFEA00] text-black font-black sticky top-0 z-50 shadow-md">
          <div className="animate-marquee">
            <span className="mx-4">/// WHAT THE GRID // AUTONOMOUS SYSTEM</span>
            <span className="mx-4">/// SYSTEM NOMINAL</span>
            <span className="mx-4">/// LAT: 34.0522 N LNG: 118.2437 W</span>
            <span className="mx-4">/// WHAT THE GRID // AUTONOMOUS SYSTEM</span>
            <span className="mx-4">/// SYSTEM NOMINAL</span>
            <span className="mx-4">/// LAT: 34.0522 N LNG: 118.2437 W</span>
          </div>
        </div>

        {/* SECTION 1: CINEMATIC BRUTALIST LANDING HERO */}
        <section className="min-h-screen w-full flex flex-col justify-between border-b-2 border-white/20 p-8 lg:p-16 bg-[#09070D] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1434FB]/10 to-transparent pointer-events-none" />
          
          <div className="flex justify-between items-center font-mono text-xs text-white/60 uppercase z-10">
            <span>[ SYSTEM.INIT // 2026 ]</span>
            <span>UTC {time}</span>
          </div>
          
          <div className="my-auto z-10 py-8">
            <div className="inline-block bg-[#1434FB] text-white font-mono text-xs px-4 py-1.5 mb-6 uppercase tracking-widest font-bold border border-white/20 shadow-lg">
              Autonomous Microgrid Intelligence Engine
            </div>
            <h1 className="text-[clamp(4.5rem,11vw,13rem)] font-black leading-[0.8] tracking-tighter uppercase mb-8">
              WHAT<br/>THE<br/>
              <span className="text-[#FFEA00]">GRID</span>
            </h1>
            <p className="font-mono text-sm tracking-widest text-white/80 max-w-2xl uppercase leading-relaxed">
              A brutalist digital twin modeling compound municipal energy stresses, autonomous EV load-shedding, and sub-second P2P routing architecture.
            </p>
          </div>

          <div className="flex justify-between items-end border-t border-white/20 pt-6 z-10">
            <button onClick={() => scrollToSection('command-center')} className="font-mono text-xs text-[#FFEA00] uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
              <ChevronDown className="w-5 h-5 animate-bounce" /> [ LAUNCH COMMAND CENTER ]
            </button>
            <div className="font-mono text-xs text-white/40 uppercase">
              STATUS: SECURE // 0.00ms LATENCY
            </div>
          </div>
        </section>

        {/* SECTION 2: CORE COMMAND CENTER */}
        <section id="command-center" className="min-h-screen grid grid-cols-1 lg:grid-cols-12 border-b-2 border-white/20">
          <div className="col-span-5 border-r border-white/20 flex flex-col justify-between bg-[#1434FB] text-white p-8 lg:p-12">
            <div>
              <div className="flex justify-between items-start mb-12">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Zap className="text-[#1434FB] w-6 h-6 animate-pulse" />
                </div>
                <div className="text-right font-mono text-xs text-white/70 leading-tight">
                  [ LIVE_NODE ]<br/>UTC {time}
                </div>
              </div>

              <h2 className="text-5xl font-black leading-none tracking-tighter uppercase mb-6">
                COMMAND<br/><span className="text-[#FFEA00]">CONSOLE</span>
              </h2>
              
              <p className="font-mono text-xs tracking-widest text-white/80 leading-relaxed uppercase max-w-[320px]">
                Real-time threat detection active. Sub-second execution logic enabled for transformer overload prevention.
              </p>
            </div>

            <div className="space-y-6">
              <button onClick={() => scrollToSection('diagnostics')} className="flex items-center gap-2 font-mono text-xs text-[#FFEA00] hover:text-white transition-colors cursor-pointer">
                <ChevronDown className="w-4 h-4 animate-bounce" /> [ VIEW ISOMETRIC TOPOLOGY ]
              </button>
              <div className="grid grid-cols-2 border border-white/20 bg-[#09070D]">
                <button onClick={triggerCrisis} className={`group flex flex-col justify-between p-6 h-32 border-r border-white/20 transition-colors cursor-pointer ${crisisStep !== 'IDLE' ? 'bg-[#FF2A2A] text-white opacity-50 cursor-not-allowed' : 'bg-[#FF2A2A] text-white hover:bg-white hover:text-[#FF2A2A]'}`}>
                  <AlertOctagon className="w-6 h-6 mb-4 transition-transform group-hover:scale-110" />
                  <span className="font-mono text-[10px] tracking-widest uppercase font-black text-left">SIMULATE<br/>CRISIS</span>
                </button>
                <button onClick={reset} className="group flex flex-col justify-between p-6 h-32 transition-colors bg-[#09070D] text-white hover:bg-[#FFEA00] hover:text-black cursor-pointer">
                  <ArrowUpRight className="w-6 h-6 mb-4 transition-transform group-hover:rotate-45" />
                  <span className="font-mono text-[10px] tracking-widest uppercase font-black text-left">RESET<br/>BASELINE</span>
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-7 flex flex-col justify-between">
            <div className={`flex-grow flex flex-col justify-center relative p-8 lg:p-12 transition-colors duration-500 ${isCritical ? 'bg-[#FF2A2A]/20' : 'bg-transparent'}`}>
              <div className="absolute top-6 left-6 font-mono text-xs tracking-widest text-white/50 uppercase flex gap-4">
                <span>[ TX-400 MAIN BUS LOAD ]</span>
                {WEBSOCKET_MODE && <span className="text-[#FFEA00] animate-pulse">WS CONNECTED</span>}
              </div>
              
              <div className="flex items-start justify-center mt-8">
                <span className={`text-[clamp(8rem,14vw,16rem)] font-black tracking-tighter leading-none transition-all duration-300 ${isCritical ? 'text-[#FF2A2A]' : 'text-white'}`}>
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

            <div className="grid grid-cols-4 border-t border-white/20 h-32 bg-[#050408]">
              {renderDataTable()}
            </div>
          </div>
        </section>

        {/* SECTION 3: DEEP DIAGNOSTICS (2.5D ISOMETRIC TOPOLOGY & SYSTEM LOGS) */}
        <section id="diagnostics" className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#050408] p-6 lg:p-12 gap-6 items-center">
          
          {/* 2.5D ISOMETRIC TOPOLOGY MAP */}
          <div className="lg:col-span-6 min-h-[560px] border border-white/25 relative p-8 flex flex-col justify-between bg-[#09070D]">
            <div className="flex justify-between items-center font-mono text-xs tracking-widest text-white/60 z-20 uppercase font-bold mb-2">
              <span>[ ISOMETRIC_TOPOLOGY_MAP ]</span>
              <span className="text-[#FFEA00] bg-[#FFEA00]/10 border border-[#FFEA00]/30 px-2 py-0.5 shadow-sm">
                ACTIVE TARGET: {activeNode}
              </span>
            </div>
            
            {/* Pristine 2.5D Isometric SVG Blueprint Canvas */}
            <div className="flex-grow relative w-full h-[380px] flex items-center justify-center my-2">
              <svg viewBox="0 0 400 360" className="w-full h-full max-h-[380px] overflow-visible select-none">
                {/* Isometric Base Grid Floor */}
                <polygon points="200,35 375,180 200,325 25,180" fill="#08070F" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                <polygon points="200,75 325,180 200,285 75,180" fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
                
                {/* Orthogonal Grid Lines */}
                <line x1="200" y1="35" x2="200" y2="325" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="25" y1="180" x2="375" y2="180" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />

                {/* Energy Transmission Bus Lines */}
                {/* Solar -> Main Grid Bus */}
                <line
                  x1="200" y1="70" x2="200" y2="180"
                  stroke={activeNode === 'SOLAR' ? '#FFEA00' : 'rgba(255,234,0,0.35)'}
                  strokeWidth={activeNode === 'SOLAR' ? 3.5 : 2}
                  className="transition-all duration-300"
                />
                {/* Main Grid Bus -> EV Fleet */}
                <line
                  x1="200" y1="180" x2="325" y2="180"
                  stroke={activeNode === 'EV' ? '#1434FB' : 'rgba(20,52,251,0.45)'}
                  strokeWidth={activeNode === 'EV' ? 3.5 : 2}
                  className="transition-all duration-300"
                />
                {/* Main Grid Bus -> BESS Battery */}
                <line
                  x1="200" y1="180" x2="200" y2="290"
                  stroke={activeNode === 'BESS' ? '#FF2A2A' : 'rgba(255,42,42,0.45)'}
                  strokeWidth={activeNode === 'BESS' ? 3.5 : 2}
                  className="transition-all duration-300"
                />

                {/* Crisis Autonomous P2P Flow (BESS -> EV Depot) */}
                {(crisisStep === 'INTERVENTION' || crisisStep === 'STABILIZED') && (
                  <g>
                    <line x1="200" y1="290" x2="325" y2="180" stroke="#FFEA00" strokeWidth="4" strokeDasharray="8 8" className="animate-[dash_0.4s_linear_infinite]" />
                    <text x="270" y="248" fill="#FFEA00" fontSize="8" fontFamily="monospace" fontWeight="bold">P2P ROUTE</text>
                  </g>
                )}

                {/* Traveling Energy Pulse Dots */}
                <circle cx="200" cy="120" r="3.5" fill="#FFEA00" className="energy-dot-solar" />
                <circle cx="265" cy="180" r="3.5" fill="#1434FB" className="energy-dot-ev" />
                <circle cx="200" cy="235" r="3.5" fill="#FF2A2A" className="energy-dot-bess" />
              </svg>

              {/* Interactive 2.5D Isometric HTML Node Buttons */}
              {/* TOP: SOLAR NODE */}
              <div className="absolute top-[8%] left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
                <button
                  onClick={() => setActiveNode(activeNode === 'SOLAR' ? 'GRID' : 'SOLAR')}
                  className={`w-12 h-12 border-2 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-xl ${
                    activeNode === 'SOLAR'
                      ? 'border-white bg-[#FFEA00] scale-110 shadow-[0_0_20px_rgba(255,234,0,0.6)]'
                      : 'border-[#FFEA00] bg-[#09070D] hover:scale-105 hover:bg-[#FFEA00]/20'
                  }`}
                >
                  <Sun className={`w-6 h-6 ${activeNode === 'SOLAR' ? 'text-black' : 'text-[#FFEA00]'}`} />
                </button>
                <span className="font-mono text-[8px] text-[#FFEA00] font-bold tracking-wider mt-1 px-1.5 py-0.5 bg-black/80 border border-[#FFEA00]/40">
                  PV_180kW
                </span>
              </div>

              {/* RIGHT: EV FLEET NODE */}
              <div className="absolute top-1/2 right-[8%] -translate-y-1/2 flex flex-col items-center z-20">
                <button
                  onClick={() => setActiveNode(activeNode === 'EV' ? 'GRID' : 'EV')}
                  className={`w-12 h-12 border-2 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-xl ${
                    activeNode === 'EV'
                      ? 'border-white bg-[#1434FB] scale-110 shadow-[0_0_20px_rgba(20,52,251,0.6)]'
                      : 'border-[#1434FB] bg-[#09070D] hover:scale-105 hover:bg-[#1434FB]/20'
                  }`}
                >
                  <Car className={`w-6 h-6 ${activeNode === 'EV' ? 'text-white' : 'text-[#1434FB]'}`} />
                </button>
                <span className="font-mono text-[8px] text-[#1434FB] font-bold tracking-wider mt-1 px-1.5 py-0.5 bg-black/80 border border-[#1434FB]/40">
                  EV_DEPOT
                </span>
              </div>

              {/* BOTTOM: BESS BATTERY NODE */}
              <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
                <span className="font-mono text-[8px] text-[#FF2A2A] font-bold tracking-wider mb-1 px-1.5 py-0.5 bg-black/80 border border-[#FF2A2A]/40">
                  BESS_98%
                </span>
                <button
                  onClick={() => setActiveNode(activeNode === 'BESS' ? 'GRID' : 'BESS')}
                  className={`w-12 h-12 border-2 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-xl ${
                    activeNode === 'BESS'
                      ? 'border-white bg-[#FF2A2A] scale-110 shadow-[0_0_20px_rgba(255,42,42,0.6)]'
                      : 'border-[#FF2A2A] bg-[#09070D] hover:scale-105 hover:bg-[#FF2A2A]/20'
                  }`}
                >
                  <Battery className={`w-6 h-6 ${activeNode === 'BESS' ? 'text-white' : 'text-[#FF2A2A]'}`} />
                </button>
              </div>

              {/* CENTER: TX-400 MAIN BUS */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30">
                <button
                  onClick={() => setActiveNode('GRID')}
                  className={`w-16 h-16 border-4 flex items-center justify-center transition-all duration-500 cursor-pointer shadow-2xl ${
                    isCritical
                      ? 'border-[#FF2A2A] bg-[#FF2A2A]/30 scale-125 shadow-[0_0_25px_rgba(255,42,42,0.8)]'
                      : activeNode === 'GRID'
                      ? 'border-[#FFEA00] bg-white/10 scale-105 shadow-[0_0_15px_rgba(255,234,0,0.5)]'
                      : 'border-white bg-[#09070D] hover:scale-105'
                  }`}
                >
                  <Zap className={`w-8 h-8 transition-colors ${isCritical ? 'text-[#FF2A2A] animate-ping' : 'text-white'}`} />
                </button>
                <span className="font-mono text-[8px] text-white font-black tracking-widest mt-1 px-1.5 py-0.5 bg-black/90 border border-white/40">
                  TX-400
                </span>
              </div>
            </div>

            <div className="font-mono text-[10px] text-white/40 uppercase mt-2">
              Click nodes to route live telemetry & sub-system diagnostics to the main deck.
            </div>
          </div>

          {/* SYSTEM LOG TERMINAL */}
          <div className="lg:col-span-6 min-h-[560px] border border-white/25 p-8 flex flex-col justify-between bg-[#09070D]">
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-xs tracking-widest text-white/50 uppercase font-bold">[ SYSTEM_LOG // EVENT_STREAM ]</span>
              <Terminal className="w-5 h-5 text-[#FFEA00]" />
            </div>
            <div className="flex-grow font-mono text-xs leading-relaxed uppercase space-y-3 overflow-y-auto pr-2 flex flex-col justify-end font-bold border border-white/15 bg-[#050408] p-6 shadow-inner">
              <p className="text-white/40 flex gap-4"><span>--:--:--</span><span>SYSTEM STANDBY - DAEMON ACTIVE</span></p>
              {crisisStep !== 'IDLE' && (
                <p className="text-[#FF2A2A] flex gap-4"><span>-0.00ms</span><span>SURGE DETECTED: CLOUD COVER + EV SPIKE</span></p>
              )}
              {(crisisStep === 'INTERVENTION' || crisisStep === 'STABILIZED') && (
                <>
                  <p className="text-[#FFEA00] flex gap-4"><span>+2.00ms</span><span>THROTTLING LOW-PRIORITY EVs: VAN-CHARLIE, VAN-DELTA</span></p>
                  <p className="text-[#1434FB] flex gap-4"><span>+2.05ms</span><span>P2P ROUTE ESTABLISHED: BESS-01 ➔ EV-DEPOT</span></p>
                </>
              )}
              {crisisStep === 'STABILIZED' && (
                <p className="text-white flex gap-4"><span>+3.50ms</span><span>GRID BALANCED & STABILIZED // CAPACITY SAFE</span></p>
              )}
            </div>
            <div className="font-mono text-[10px] text-white/40 uppercase mt-4">Sub-second autonomous event tracking operational.</div>
          </div>
        </section>
      </div>
    </>
  );
}