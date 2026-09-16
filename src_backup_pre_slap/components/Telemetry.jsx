import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Telemetry — Grid load vs. solar chart + KPI stats row.
 * Redesigned with dark minimal style, large accent numbers.
 */
export default function Telemetry({ chartData, load, isCrisis }) {
  const latest = chartData[chartData.length - 1];
  const solar = latest?.solar ?? 154;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "rgba(17,16,25,0.96)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: "10px 14px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
        }}
      >
        <div style={{ color: "rgba(247,247,242,0.4)", marginBottom: 6, letterSpacing: "0.1em" }}>{label}</div>
        {payload.map((p) => (
          <div key={p.name} style={{ color: p.stroke, marginBottom: 2 }}>
            {p.name.toUpperCase()}: <strong>{p.value} kW</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="panel" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className="font-mono text-[9px] uppercase tracking-[0.25em]"
              style={{ color: "rgba(247,247,242,0.3)" }}
            >
              Grid Telemetry
            </div>
            <div
              className="font-display text-sm font-600 tracking-wide mt-0.5"
              style={{ color: "#F7F7F2" }}
            >
              Load vs. Solar · Live
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: isCrisis ? "#FF3CAC" : "#315CFF" }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: "rgba(247,247,242,0.4)" }}>Load</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF7A00" }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: "rgba(247,247,242,0.4)" }}>Solar</span>
            </div>
          </div>
        </div>

        {/* Big stat numbers */}
        <div className="mt-4 flex gap-6">
          <div>
            <div
              className="font-mono text-3xl font-700 leading-none"
              style={{
                color: isCrisis ? "#FF3CAC" : "#315CFF",
                textShadow: isCrisis ? "0 0 20px rgba(255,60,172,0.4)" : "0 0 20px rgba(49,92,255,0.4)",
                transition: "color 0.5s ease, text-shadow 0.5s ease",
              }}
            >
              {load}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] mt-1" style={{ color: "rgba(247,247,242,0.3)" }}>
              kW LOAD
            </div>
          </div>

          <div
            className="w-px self-stretch"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />

          <div>
            <div
              className="font-mono text-3xl font-700 leading-none"
              style={{ color: "#FF7A00", textShadow: "0 0 20px rgba(255,122,0,0.3)" }}
            >
              {solar}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] mt-1" style={{ color: "rgba(247,247,242,0.3)" }}>
              kW SOLAR
            </div>
          </div>

          <div
            className="w-px self-stretch"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />

          <div>
            <div
              className="font-mono text-3xl font-700 leading-none"
              style={{ color: "#C8FF38", textShadow: "0 0 20px rgba(200,255,56,0.3)" }}
            >
              49.98
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] mt-1" style={{ color: "rgba(247,247,242,0.3)" }}>
              Hz FREQ
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-4 pt-2" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="loadGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isCrisis ? "#FF3CAC" : "#315CFF"} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isCrisis ? "#FF3CAC" : "#315CFF"} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="solarGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF7A00" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#FF7A00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(247,247,242,0.2)", fontSize: 8, fontFamily: "JetBrains Mono" }}
            />
            <YAxis
              domain={[0, 450]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(247,247,242,0.2)", fontSize: 8, fontFamily: "JetBrains Mono" }}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="load"
              stroke={isCrisis ? "#FF3CAC" : "#315CFF"}
              strokeWidth={2}
              fill="url(#loadGrad2)"
              dot={false}
              activeDot={{ r: 3, fill: isCrisis ? "#FF3CAC" : "#315CFF" }}
            />
            <Area
              type="monotone"
              dataKey="solar"
              stroke="#FF7A00"
              strokeWidth={1.5}
              fill="url(#solarGrad2)"
              dot={false}
              activeDot={{ r: 3, fill: "#FF7A00" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
