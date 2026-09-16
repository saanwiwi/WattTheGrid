import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, Zap, Sun, Battery, Car, AlertOctagon, Terminal } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import CursorFX from './components/CursorFX';
import GridAmbient from './components/GridAmbient';

// BACKEND TEAM: Flip this to true and point it to your WebSocket URL when ready.
const WEBSOCKET_MODE = false;
const WS_URL = 'ws://localhost:8000/ws';

export default function App() {
  const [crisisStep, setCrisisStep] = useState('IDLE');
  const [time, setTime] = useState('');
  const [activeNode, setActiveNode] = useState('GRID');
  const [hoveredNode, setHoveredNode] = useState(null);

  // Individual EV Array (The Heuristic Target List)
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

  // 1. UI High-Speed Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric", fractionalSecondDigits: 2 }).replace(':', ':')), 50);
    return () => clearInterval(timer);
  }, []);

  // 2. The Backend / Local Physics Engine
  useEffect(() => {
    if (WEBSOCKET_MODE) {
      const ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Backend injects raw JSON state here
        if(data.telemetry) setTelemetry(data.telemetry);
        if(data.evList) setEvList(data.evList);
        if(data.load) setLoad(data.load);
        if(data.crisisStep) setCrisisStep(data.crisisStep);
      };
      return () => ws.close();
    }

    // Local Hackathon Physics Engine (runs if no backend)
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
  }, [telemetry, evList]);

  // Autonomous Mitigation Simulation
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
      // The Heuristic Optimizer Action: Drop low priority, dump BESS to compensate
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
  const isCrisis = crisisStep !== 'IDLE';

  // — Ambient log messages (purely visual, non-crisis) —
  const AMBIENT = [
    'FREQ: 49.97 Hz — WITHIN TOLERANCE',
    'SOLAR ARRAY TEMP: 38°C — NOMINAL',
    'BESS CELL BALANCE: OK',
    'AUTO-CONTROL LOOP: ACTIVE',
    'GRID_SYNC: PHASE LOCKED 0.01°',
    'EV DEPOT COMM: ESTABLISHED',
    'VOLTAGE_REG: 415V NOMINAL',
    'INVERTER EFFICIENCY: 96.2%',
  ];
  const [ambientLogs, setAmbientLogs] = useState([]);
  useEffect(() => {
    if (crisisStep !== 'IDLE') { setAmbientLogs([]); return; }
    const id = setInterval(() => {
      const msg = AMBIENT[Math.floor(Math.random() * AMBIENT.length)];
      const ts  = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setAmbientLogs(prev => [...prev.slice(-2), { msg, ts }]);
    }, 3800);
    return () => clearInterval(id);
  }, [crisisStep]);

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

  // Dynamic Data Table Routing
  const renderDataTable = () => {
    if (activeNode === 'EV') {
      return evList.map(ev => (
        <div key={ev.id} className={`border-r border-white/20 p-4 flex flex-col justify-between transition-colors ${ev.status === 'THROTTLED' ? 'bg-[#FF2A2A] text-white' : 'hover:bg-[#1434FB] hover:text-white'}`}>
          <span className="font-mono text-[9px] tracking-widest opacity-60 font-bold">{ev.id} // {ev.priority}</span>
          <div className="flex justify-between items-baseline mt-2 gap-1">
            <span className="text-xl font-black font-mono">{ev.draw}<span className="text-[10px] ml-1 opacity-70">kW</span></span>
            <span className="font-mono text-[8px] font-bold opacity-80 uppercase text-right leading-tight whitespace-nowrap">{ev.status}<br/>{ev.soc}% SOC</span>
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
          <div className="flex justify-between items-end">
            <span className="text-2xl font-black font-mono text-white">200<span className="text-xs ml-1 opacity-50">kW</span></span>
            <div className="flex items-end gap-1 h-6 pb-1 opacity-60">
              <span className="w-1 bg-white/40 h-3 animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 bg-white/70 h-5 animate-pulse" style={{ animationDelay: '200ms' }} />
              <span className="w-1 bg-white/50 h-4 animate-pulse" style={{ animationDelay: '400ms' }} />
              <span className="w-1 bg-white/30 h-2 animate-pulse" style={{ animationDelay: '600ms' }} />
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
      `}</style>

      <div className={`min-h-screen bg-[#09070D] text-[#F7F7F2] font-sans selection:bg-[#FFEA00] selection:text-black flex flex-col overflow-hidden brutalist-grid ${isCrisis ? 'crisis-vignette' : ''}`} style={{ position: 'relative', zIndex: 2 }}>
        
        {/* TOP TICKER TAPE */}
        <div className={`border-b-2 border-black py-2 overflow-hidden flex whitespace-nowrap text-[11px] font-mono tracking-[0.2em] uppercase ${isCritical ? 'bg-[#FF2A2A] text-white font-black' : 'bg-[#FFEA00] text-black font-black'}`}>
          <div className="animate-marquee">
            <span className="mx-4">/// WHAT THE GRID // AUTONOMOUS SYSTEM</span>
            <span className="mx-4">/// {isCritical ? 'CRITICAL OVERLOAD DETECTED' : 'SYSTEM NOMINAL'}</span>
            <span className="mx-4">/// LAT: 34.0522 N LNG: 118.2437 W</span>
            <span className="mx-4">/// WHAT THE GRID // AUTONOMOUS SYSTEM</span>
            <span className="mx-4">/// {isCritical ? 'CRITICAL OVERLOAD DETECTED' : 'SYSTEM NOMINAL'}</span>
            <span className="mx-4">/// LAT: 34.0522 N LNG: 118.2437 W</span>
          </div>
        </div>

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 h-full">
          
          {/* LEFT: MASSIVE TYPOGRAPHY */}
          <div className="col-span-4 border-r border-white/20 flex flex-col justify-between bg-[#1434FB] text-white">
            <div className="p-8 lg:p-12">
              <div className="flex justify-between items-start mb-12">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                  <Zap className="text-[#1434FB] w-6 h-6 animate-pulse" />
                </div>
                <div className="text-right font-mono text-xs text-white/70 leading-tight mix-blend-screen">
                  [ LIVE_NODE ]<br/>UTC {time}
                </div>
              </div>

              <h1 className="text-[clamp(4rem,7vw,8rem)] font-black leading-[0.85] tracking-tighter uppercase mb-8">
                WHAT<br/>THE<br/>
                <span className={isCritical ? 'text-[#FF2A2A]' : 'text-[#FFEA00]'}>GRID</span>
              </h1>
              
              <p className="font-mono text-xs tracking-widest text-white/80 leading-relaxed uppercase max-w-[280px]">
                The grid is alive. Modeling compound microgrid stresses in real-time. Sub-second execution logic enabled.
              </p>
            </div>

            <div className="grid grid-cols-2 border-t border-white/20 bg-[#09070D]">
              <button onClick={triggerCrisis} className={`group flex flex-col justify-between p-6 h-32 border-r border-white/20 transition-colors ${crisisStep !== 'IDLE' ? 'bg-[#FF2A2A] text-white opacity-50 cursor-not-allowed' : 'bg-[#FF2A2A] text-white hover:bg-white hover:text-[#FF2A2A] cursor-pointer'}`}>
                <AlertOctagon className="w-6 h-6 mb-4 transition-transform group-hover:scale-110" />
                <span className="font-mono text-[10px] tracking-widest uppercase font-black text-left">SIMULATE<br/>CRISIS</span>
              </button>
              <button onClick={reset} className="group flex flex-col justify-between p-6 h-32 transition-colors bg-[#09070D] text-white hover:bg-[#FFEA00] hover:text-black cursor-pointer">
                <ArrowUpRight className="w-6 h-6 mb-4 transition-transform group-hover:rotate-45" />
                <span className="font-mono text-[10px] tracking-widest uppercase font-black text-left">RESET<br/>BASELINE</span>
              </button>
            </div>
          </div>

          {/* CENTER: THE SCULPTURAL DATA */}
          <div className="col-span-5 border-r border-white/20 flex flex-col">
            <div className={`flex-grow flex flex-col justify-center relative p-8 transition-colors duration-500 ${isCritical ? 'bg-[#FF2A2A]/20' : 'bg-transparent'}`}>
              <div className="absolute top-6 left-6 font-mono text-[10px] tracking-widest text-white/50 uppercase flex gap-4">
                <span>[ TX-400 MAIN BUS LOAD ]</span>
                {WEBSOCKET_MODE && <span className="text-[#FFEA00] animate-pulse">WS CONNECTED</span>}
              </div>
              
              {/* Hero radial glow — pulses slowly behind the kW number */}
              <div
                className="hero-radial"
                style={{
                  background: isCritical
                    ? 'radial-gradient(ellipse 55% 35% at 50% 52%, rgba(255,42,42,0.10) 0%, transparent 70%)'
                    : 'radial-gradient(ellipse 55% 35% at 50% 52%, rgba(20,52,251,0.09) 0%, transparent 70%)',
                }}
              />
              <div className="flex items-start justify-center mt-12">
                <span
                  className={`text-[clamp(8rem,14vw,18rem)] font-black tracking-tighter leading-none transition-all duration-300 ${isCritical ? 'text-[#FF2A2A]' : 'text-white'}`}
                  style={{ textShadow: isCritical ? '0 0 60px rgba(255,42,42,0.22)' : '0 0 60px rgba(255,255,255,0.06)' }}
                >
                  {load}
                </span>
                <span className="text-2xl font-mono text-[#1434FB] mt-8 ml-2 font-bold">kW</span>
              </div>

              <div className="w-full h-24 mt-8 opacity-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <YAxis domain={[0, 500]} hide />
                    <Area type="stepAfter" dataKey="load" stroke={isCritical ? '#FF2A2A' : '#FFEA00'} strokeWidth={3} fill="transparent" isAnimationActive={false} />
                    <Area type="monotone" dataKey="threshold" stroke="#ffffff" strokeDasharray="3 3" strokeWidth={1} fill="transparent" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="absolute bottom-6 w-full px-12 left-0">
                <div className="flex justify-between font-mono text-[10px] text-white/50 mb-2 font-bold">
                  <span>0 kW</span>
                  <span className="text-[#FF2A2A] animate-pulse">THRESHOLD: 425 kW</span>
                  <span>500 kW MAX</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-none overflow-hidden border border-white/20">
                  <div className={`h-full transition-all duration-700 ease-out ${isCritical ? 'bg-[#FF2A2A]' : 'bg-[#FFEA00]'}`} style={{ width: `${(load / 500) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* EV MATRIX / MAIN DATA TABLE */}
            <div className="grid grid-cols-4 border-t border-white/20 h-32 bg-[#050408] instrument-cell">
              {renderDataTable()}
            </div>
          </div>

          {/* RIGHT: 2.5D ISOMETRIC TOPOLOGY & TERMINAL */}
          <div className="col-span-3 flex flex-col bg-[#050408]">
            
            <div className="h-1/2 border-b border-white/20 relative p-6 flex flex-col perspective-[1000px] overflow-hidden">
              <div className="flex justify-between font-mono text-[10px] tracking-widest text-white/50 mb-4 z-20 relative uppercase font-bold">
                <span>[ ISOMETRIC_TOPOLOGY ]</span>
                <span className="text-[#FFEA00]">TARGET: {activeNode}</span>
              </div>
              
              <div className="flex-grow relative flex items-center justify-center">
                <div style={{ transform: 'rotateX(60deg) rotateZ(-45deg)', transformStyle: 'preserve-3d' }} className="relative w-48 h-48 transition-transform duration-700 ease-in-out hover:rotate-x-[55deg] hover:rotate-z-[-40deg]">
                  
                  {/* Floor Grid */}
                  <div className="absolute w-full h-[2px] bg-white/20 top-1/2 -translate-y-1/2" />
                  <div className="absolute h-full w-[2px] bg-white/20 left-1/2 -translate-x-1/2" />
                  <div className="absolute w-full h-full border-2 border-white/10" />

                  {/* Topology connection lines — dim always, brighten when node active or hovered */}
                  <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none', zIndex: 0 }}>
                    <line x1="50%" y1="50%" x2="50%" y2="-4"
                      stroke={(activeNode === 'SOLAR' || hoveredNode === 'SOLAR') ? '#FFEA00' : 'rgba(255,234,0,0.18)'}
                      strokeWidth={(activeNode === 'SOLAR' || hoveredNode === 'SOLAR') ? 2 : 1}
                      className={(activeNode === 'SOLAR' || hoveredNode === 'SOLAR') ? 'topo-line-active' : 'topo-line-idle'}
                    />
                    <line x1="50%" y1="50%" x2="104%" y2="50%"
                      stroke={(activeNode === 'EV' || hoveredNode === 'EV') ? '#1434FB' : 'rgba(20,52,251,0.22)'}
                      strokeWidth={(activeNode === 'EV' || hoveredNode === 'EV') ? 2 : 1}
                      className={(activeNode === 'EV' || hoveredNode === 'EV') ? 'topo-line-active' : 'topo-line-idle'}
                    />
                    <line x1="50%" y1="50%" x2="50%" y2="104%"
                      stroke={(activeNode === 'BESS' || hoveredNode === 'BESS') ? '#FF2A2A' : 'rgba(255,42,42,0.22)'}
                      strokeWidth={(activeNode === 'BESS' || hoveredNode === 'BESS') ? 2 : 1}
                      className={(activeNode === 'BESS' || hoveredNode === 'BESS') ? 'topo-line-active' : 'topo-line-idle'}
                    />
                  </svg>

                  {/* P2P Flow Visualization: SVG Line from Battery to EV */}
                  {(crisisStep === 'INTERVENTION' || crisisStep === 'STABILIZED') && (
                    <svg className="absolute inset-0 w-full h-full z-0 overflow-visible">
                      {/* Battery (-bottom-4, left-1/2) to EV (top-1/2, -right-4) */}
                      <line x1="50%" y1="100%" x2="100%" y2="50%" stroke="#FFEA00" strokeWidth="4" strokeDasharray="8 8" style={{ animation: 'dash 0.5s linear infinite' }} />
                    </svg>
                  )}
                  
                  {/* Floating Nodes — with breathing glow & hover response */}
                  <button
                    onClick={() => setActiveNode('SOLAR')}
                    onMouseEnter={() => setHoveredNode('SOLAR')}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ transform: 'rotateZ(45deg) rotateX(-60deg) translateZ(20px)' }}
                    className={`absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 border-2 ${activeNode === 'SOLAR' ? 'border-white bg-[#FFEA00]' : 'border-[#FFEA00] bg-[#09070D]'} ${(activeNode === 'SOLAR' || hoveredNode === 'SOLAR') ? 'scale-110 shadow-[0_0_16px_rgba(255,234,0,0.5)]' : ''} rounded-none flex items-center justify-center transition-all duration-300 cursor-pointer z-10 node-breath-yellow`}
                  >
                    <Sun className={`w-5 h-5 ${activeNode === 'SOLAR' ? 'text-black' : 'text-[#FFEA00]'}`} />
                  </button>
                  
                  <button
                    onClick={() => setActiveNode('EV')}
                    onMouseEnter={() => setHoveredNode('EV')}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ transform: 'rotateZ(45deg) rotateX(-60deg) translateZ(20px)' }}
                    className={`absolute top-1/2 -right-4 -translate-y-1/2 w-10 h-10 border-2 ${activeNode === 'EV' ? 'border-white bg-[#1434FB]' : 'border-[#1434FB] bg-[#09070D]'} ${(activeNode === 'EV' || hoveredNode === 'EV') ? 'scale-110 shadow-[0_0_16px_rgba(20,52,251,0.5)]' : ''} rounded-none flex items-center justify-center transition-all duration-300 cursor-pointer z-10 node-breath-blue`}
                  >
                    <Car className={`w-5 h-5 ${activeNode === 'EV' ? 'text-white' : 'text-[#1434FB]'}`} />
                  </button>
                  
                  <button
                    onClick={() => setActiveNode('BESS')}
                    onMouseEnter={() => setHoveredNode('BESS')}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ transform: 'rotateZ(45deg) rotateX(-60deg) translateZ(20px)' }}
                    className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 border-2 ${activeNode === 'BESS' ? 'border-white bg-[#FF2A2A]' : 'border-[#FF2A2A] bg-[#09070D]'} ${(activeNode === 'BESS' || hoveredNode === 'BESS') ? 'scale-110 shadow-[0_0_16px_rgba(255,42,42,0.5)]' : ''} rounded-none flex items-center justify-center transition-all duration-300 cursor-pointer z-10 node-breath-red`}
                  >
                    <Battery className={`w-5 h-5 ${activeNode === 'BESS' ? 'text-white' : 'text-[#FF2A2A]'}`} />
                  </button>

                  <button
                    onClick={() => setActiveNode('GRID')}
                    onMouseEnter={() => setHoveredNode('GRID')}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ transform: 'rotateZ(45deg) rotateX(-60deg) translateZ(40px)' }}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 border-4 flex items-center justify-center z-20 transition-all duration-500 cursor-pointer node-breath-white ${isCritical ? 'border-[#FF2A2A] scale-125 bg-[#FF2A2A]/20' : activeNode === 'GRID' ? 'border-[#FFEA00] bg-white/10' : 'border-white bg-[#09070D]'} ${hoveredNode === 'GRID' ? 'scale-110 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : ''}`}
                  >
                    <Zap className={`w-6 h-6 transition-colors ${isCritical ? 'text-[#FF2A2A] animate-ping' : 'text-white'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="h-1/2 p-6 flex flex-col relative">
              {/* Ambient scan line across log panel */}
              <div className="log-scan-line" />
              <div className="flex justify-between items-center mb-6">
                <span className="font-mono text-[10px] tracking-widest text-white/50 uppercase font-bold">[ SYSTEM_LOG ]</span>
                <Terminal className="w-4 h-4 text-white/40" />
              </div>
              <div className="flex-grow font-mono text-[10px] leading-relaxed uppercase space-y-3 overflow-y-auto pr-2 flex flex-col justify-end font-bold">
                <p className="text-white/30 flex gap-4"><span>--:--:--</span><span>AUTO-CONTROL LOOP INITIALIZED</span></p>
                {ambientLogs.map((l, i) => (
                  <p key={i} className="text-white/40 flex gap-4 log-entry"><span>{l.ts}</span><span>{l.msg}</span></p>
                ))}
                <p className="text-white/50 flex gap-4"><span>--:--:--</span><span>SYSTEM STANDBY</span></p>
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
                  <p className="text-white flex gap-4"><span>+3.50ms</span><span>GRID BALANCED & STABILIZED</span></p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas visual layers — pointer-events:none, never block clicks */}
      <GridAmbient isCrisis={isCrisis} />
      <CursorFX    isCrisis={isCrisis} />
    </>
  );
}