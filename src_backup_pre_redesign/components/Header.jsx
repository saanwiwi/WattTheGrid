import { useEffect, useState } from "react";

/**
 * Header — Command center masthead with live clock, system status.
 */
export default function Header({ running, isCrisis }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl"
      style={{
        background: "rgba(9,7,13,0.92)",
        boxShadow: isCrisis
          ? "0 1px 0 rgba(255,60,172,0.3), 0 4px 40px rgba(255,60,172,0.1)"
          : "0 1px 0 rgba(49,92,255,0.15), 0 4px 40px rgba(49,92,255,0.05)",
        transition: "box-shadow 0.8s ease",
      }}
    >
      <div className="mx-auto flex h-[60px] max-w-[1600px] items-center justify-between px-5 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-4">
          {/* Logo mark */}
          <div className="relative flex-shrink-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: isCrisis
                  ? "linear-gradient(135deg, rgba(255,60,172,0.2), rgba(255,122,0,0.1))"
                  : "linear-gradient(135deg, rgba(49,92,255,0.2), rgba(139,92,246,0.1))",
                border: isCrisis ? "1px solid rgba(255,60,172,0.4)" : "1px solid rgba(49,92,255,0.4)",
                boxShadow: isCrisis ? "0 0 16px rgba(255,60,172,0.25)" : "0 0 16px rgba(49,92,255,0.25)",
                transition: "all 0.8s ease",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z"
                  stroke={isCrisis ? "#FF3CAC" : "#315CFF"} strokeWidth="1.5" fill="none" />
                <path d="M9 6L12 8V12L9 14L6 12V8L9 6Z"
                  fill={isCrisis ? "rgba(255,60,172,0.4)" : "rgba(49,92,255,0.4)"} />
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-0.5">
              <span
                className="font-display text-sm font-700 tracking-tight"
                style={{ color: "#F7F7F2", letterSpacing: "0.02em" }}
              >
                COMMUNITY
              </span>
              <span
                className="font-display text-sm font-700 tracking-tight"
                style={{
                  color: isCrisis ? "#FF3CAC" : "#315CFF",
                  textShadow: isCrisis ? "0 0 12px rgba(255,60,172,0.6)" : "0 0 12px rgba(49,92,255,0.6)",
                  transition: "all 0.8s ease",
                }}
              >
                GRID
              </span>
              <span
                className="font-display ml-1.5 text-sm font-700 tracking-tight"
                style={{ color: "#F7F7F2", opacity: 0.4, letterSpacing: "0.02em" }}
              >
                // TWIN-01
              </span>
            </div>
            <div
              className="font-mono text-[9px] tracking-[0.22em] uppercase"
              style={{ color: "rgba(247,247,242,0.3)" }}
            >
              Autonomous Microgrid Control System
            </div>
          </div>
        </div>

        {/* Center — Status bar */}
        <div className="hidden items-center gap-6 md:flex">
          <div
            className="flex items-center gap-2"
            style={{ color: "rgba(247,247,242,0.35)", fontSize: "10px", letterSpacing: "0.18em" }}
          >
            <span className="font-mono">GRID NODE 01</span>
          </div>

          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isCrisis ? "#FF3CAC" : "#C8FF38",
                boxShadow: isCrisis
                  ? "0 0 8px #FF3CAC, 0 0 16px rgba(255,60,172,0.5)"
                  : "0 0 8px #C8FF38, 0 0 16px rgba(200,255,56,0.5)",
                animation: "pulse 1.5s ease-in-out infinite",
                transition: "all 0.5s ease",
              }}
            />
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{
                color: isCrisis ? "#FF3CAC" : "#C8FF38",
                transition: "color 0.5s ease",
              }}
            >
              {isCrisis ? "CRISIS RESPONSE ACTIVE" : running ? "SIMULATION RUNNING" : "ALL SYSTEMS NOMINAL"}
            </span>
          </div>
        </div>

        {/* Right — Clock */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="font-mono text-xs" style={{ color: "#F7F7F2" }}>
              {timeStr}
            </div>
            <div className="font-mono text-[9px]" style={{ color: "rgba(247,247,242,0.3)", letterSpacing: "0.12em" }}>
              {dateStr}
            </div>
          </div>

          {/* Live indicator */}
          <div
            className="flex items-center gap-1.5 rounded px-2 py-1"
            style={{
              background: "rgba(200,255,56,0.08)",
              border: "1px solid rgba(200,255,56,0.2)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#C8FF38", animation: "pulse 1s ease-in-out infinite" }}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "#C8FF38" }}>
              LIVE
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
