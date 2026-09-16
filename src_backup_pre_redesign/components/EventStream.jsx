import { useEffect, useRef } from "react";
import { LOG_TYPE_COLOR } from "../data/gridData";

/**
 * EventStream — Live scrolling event log.
 * Looks like an active control-room feed.
 */
export default function EventStream({ logs, isCrisis }) {
  const bottomRef = useRef(null);

  // Auto-scroll to top (newest first)
  useEffect(() => {
    // Logs are prepended (newest first), no scroll needed
  }, [logs]);

  const typeLabel = (type) => {
    const labels = {
      ALERT:  "⚠ ALERT",
      CRISIS: "⚠ CRISIS",
      AI:     "⬡ AI",
      BESS:   "⬡ BESS",
      EV:     "⬡ EV",
      SOLAR:  "⬡ SOLAR",
      GRID:   "⬡ GRID",
      SYSTEM: "⬡ SYS",
    };
    return labels[type] || type;
  };

  return (
    <div
      className="panel flex flex-col"
      style={{
        border: "1px solid rgba(255,255,255,0.06)",
        minHeight: 260,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "#8B5CF6",
              boxShadow: "0 0 8px rgba(139,92,246,0.6)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <span
            className="font-display text-xs font-600 uppercase tracking-[0.18em]"
            style={{ color: "#F7F7F2" }}
          >
            Event Stream
          </span>
        </div>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.2em]"
          style={{ color: "rgba(247,247,242,0.25)" }}
        >
          LIVE FEED
        </span>
      </div>

      {/* Autonomous controller header */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div
              className="font-display text-[10px] font-600 uppercase tracking-[0.2em]"
              style={{ color: "rgba(247,247,242,0.35)" }}
            >
              Autonomous Control
            </div>
            <div
              className="font-display text-xs font-700 tracking-wide mt-0.5"
              style={{ color: isCrisis ? "#FF3CAC" : "#8B5CF6" }}
            >
              {isCrisis ? "CRISIS RESPONSE ACTIVE" : "SYSTEM ONLINE"}
            </div>
          </div>
          <div
            className="rounded px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] flex items-center gap-1.5"
            style={{
              background: isCrisis ? "rgba(255,60,172,0.1)" : "rgba(139,92,246,0.1)",
              border: isCrisis ? "1px solid rgba(255,60,172,0.2)" : "1px solid rgba(139,92,246,0.2)",
              color: isCrisis ? "#FF3CAC" : "#8B5CF6",
              transition: "all 0.8s ease",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isCrisis ? "#FF3CAC" : "#8B5CF6",
                animation: "pulse 1s ease-in-out infinite",
              }}
            />
            AI ONLINE
          </div>
        </div>

        {/* Objective */}
        <div
          className="mt-2 rounded p-2 font-mono text-[10px] leading-relaxed"
          style={{ background: "rgba(255,255,255,0.02)", color: "rgba(247,247,242,0.5)" }}
        >
          Maintain transformer load below{" "}
          <span style={{ color: "#315CFF" }}>425 kW</span>{" "}
          while balancing renewable generation, storage, and EV demand.
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ maxHeight: 280 }}>
        {logs.map((log, i) => {
          const color = LOG_TYPE_COLOR[log.type] || "#F7F7F2";
          return (
            <div
              key={`${log.time}-${i}`}
              className="flex gap-3 rounded-lg px-2 py-2 group transition-colors"
              style={{
                background: i === 0 ? `${color}08` : "transparent",
                borderLeft: i === 0 ? `2px solid ${color}60` : "2px solid transparent",
                animation: i === 0 ? "rise-in 0.4s ease-out" : undefined,
              }}
            >
              {/* Dot */}
              <div className="mt-1 flex-shrink-0">
                <span
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{
                    background: color,
                    boxShadow: i === 0 ? `0 0 6px ${color}` : "none",
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: "rgba(247,247,242,0.25)" }}
                  >
                    {log.time}
                  </span>
                  <span
                    className="font-mono text-[8px] font-700 uppercase tracking-[0.12em]"
                    style={{ color }}
                  >
                    {typeLabel(log.type)}
                  </span>
                </div>
                <p
                  className="mt-0.5 font-mono text-[10px] leading-relaxed"
                  style={{ color: "rgba(247,247,242,0.6)" }}
                >
                  {log.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
