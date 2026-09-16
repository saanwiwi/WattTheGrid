import { useMemo } from "react";
import { TRANSFORMER_CAPACITY } from "../data/gridData";

/**
 * Transformer — Dramatic circular arc meter visualizing transformer load.
 * The visual hero of the dashboard.
 */
export default function Transformer({ load, isCrisis }) {
  const capacity = TRANSFORMER_CAPACITY;
  const pct = Math.min(load / capacity, 1);
  const headroom = capacity - load;

  // SVG arc math
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R_OUTER = 82;
  const R_INNER = 64;
  const R_TRACK = 74;

  // Arc from 210° to 330° (240° sweep, starts bottom-left, ends bottom-right)
  const START_ANGLE = 210;
  const SWEEP = 240;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const arcPath = (r, startDeg, sweepDeg) => {
    const s = toRad(startDeg - 90);
    const e = toRad(startDeg - 90 + sweepDeg);
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)}
            A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`;
  };

  const arcPathFill = (r, startDeg, sweepDeg) => {
    if (sweepDeg <= 0) return "";
    return arcPath(r, startDeg, Math.min(sweepDeg, 239.9));
  };

  const filledSweep = pct * SWEEP;

  // Color zones
  const arcColor = useMemo(() => {
    if (isCrisis) return "#FF3CAC";
    if (pct > 0.97) return "#FF3CAC";
    if (pct > 0.9) return "#FF7A00";
    return "#315CFF";
  }, [pct, isCrisis]);

  const glowColor = useMemo(() => {
    if (isCrisis) return "rgba(255,60,172,0.6)";
    if (pct > 0.97) return "rgba(255,60,172,0.5)";
    if (pct > 0.9) return "rgba(255,122,0,0.4)";
    return "rgba(49,92,255,0.4)";
  }, [pct, isCrisis]);

  // Tick marks
  const ticks = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => {
      const angle = START_ANGLE - 90 + (SWEEP / 12) * i;
      const rad = toRad(angle);
      const isLarge = i % 4 === 0;
      const rIn = isLarge ? R_OUTER - 6 : R_OUTER - 4;
      return {
        x1: cx + (R_OUTER + 2) * Math.cos(rad),
        y1: cy + (R_OUTER + 2) * Math.sin(rad),
        x2: cx + rIn * Math.cos(rad),
        y2: cy + rIn * Math.sin(rad),
        large: isLarge,
      };
    });
  }, []);

  return (
    <div
      className="panel flex flex-col items-center relative"
      style={{
        border: isCrisis ? "1px solid rgba(255,60,172,0.3)" : "1px solid rgba(49,92,255,0.2)",
        boxShadow: isCrisis
          ? "0 0 60px rgba(255,60,172,0.12), inset 0 0 40px rgba(255,60,172,0.04)"
          : "0 0 60px rgba(49,92,255,0.08), inset 0 0 40px rgba(49,92,255,0.02)",
        transition: "all 0.8s ease",
      }}
    >
      {/* Header */}
      <div className="w-full px-5 pt-5 flex items-start justify-between">
        <div>
          <div
            className="font-mono text-[9px] uppercase tracking-[0.25em]"
            style={{ color: "rgba(247,247,242,0.3)" }}
          >
            Main Distribution
          </div>
          <div
            className="font-display text-sm font-600 tracking-wide mt-0.5"
            style={{ color: "#F7F7F2" }}
          >
            TRANSFORMER
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em]"
          style={{
            background: isCrisis ? "rgba(255,60,172,0.1)" : "rgba(49,92,255,0.1)",
            border: isCrisis ? "1px solid rgba(255,60,172,0.25)" : "1px solid rgba(49,92,255,0.25)",
            color: isCrisis ? "#FF3CAC" : "#315CFF",
            transition: "all 0.8s ease",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: isCrisis ? "#FF3CAC" : "#C8FF38",
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          />
          {isCrisis ? "OVERLOAD" : pct > 0.97 ? "CRITICAL" : pct > 0.9 ? "WARNING" : "STABLE"}
        </div>
      </div>

      {/* SVG Arc Meter */}
      <div className="relative mt-2">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <defs>
            <filter id="xfmr-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="arcFillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={arcColor} stopOpacity="0.7" />
              <stop offset="100%" stopColor={arcColor} stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <path
            d={arcPath(R_TRACK, START_ANGLE, SWEEP)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
          />

          {/* Fill arc */}
          {filledSweep > 0 && (
            <path
              d={arcPathFill(R_TRACK, START_ANGLE, filledSweep)}
              stroke={arcColor}
              strokeWidth={14}
              fill="none"
              strokeLinecap="round"
              filter="url(#xfmr-glow)"
              style={{ transition: "stroke-dasharray 0.7s ease, stroke 0.8s ease" }}
            />
          )}

          {/* Tick marks */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.large ? "rgba(247,247,242,0.25)" : "rgba(247,247,242,0.1)"}
              strokeWidth={t.large ? 1 : 0.5}
            />
          ))}

          {/* Center: huge number */}
          <text
            x={cx} y={cy - 8}
            textAnchor="middle"
            fill={isCrisis ? "#FF3CAC" : "#F7F7F2"}
            fontSize="30"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
            filter={isCrisis ? "url(#xfmr-glow)" : undefined}
            style={{ transition: "fill 0.5s ease" }}
          >
            {load}
          </text>
          <text
            x={cx} y={cy + 10}
            textAnchor="middle"
            fill="rgba(247,247,242,0.4)"
            fontSize="8"
            fontFamily="Space Grotesk, sans-serif"
            fontWeight="500"
            letterSpacing="0.1em"
          >
            kW LIVE LOAD
          </text>

          {/* Pct arc label */}
          <text
            x={cx} y={cy + 26}
            textAnchor="middle"
            fill={arcColor}
            fontSize="7"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="600"
            style={{ transition: "fill 0.5s ease" }}
          >
            {(pct * 100).toFixed(1)}%
          </text>
        </svg>

        {/* Glow disc behind the number */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -54%)",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: glowColor,
            filter: "blur(28px)",
            opacity: 0.35,
            pointerEvents: "none",
            transition: "background 0.8s ease",
          }}
        />
      </div>

      {/* Stats row */}
      <div className="w-full px-5 pb-5 grid grid-cols-3 gap-2 mt-1">
        {[
          { label: "CAPACITY", value: `${capacity} kW`, color: "rgba(247,247,242,0.5)" },
          { label: "HEADROOM", value: `${headroom} kW`, color: headroom < 30 ? "#FF3CAC" : headroom < 60 ? "#FF7A00" : "#C8FF38" },
          { label: "OF 425 kW", value: `${(pct * 100).toFixed(0)}%`, color: arcColor },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg p-2.5 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="font-mono text-[8px] uppercase tracking-[0.15em]" style={{ color: "rgba(247,247,242,0.3)" }}>
              {stat.label}
            </div>
            <div className="font-mono text-sm font-600 mt-0.5" style={{ color: stat.color, transition: "color 0.5s ease" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
