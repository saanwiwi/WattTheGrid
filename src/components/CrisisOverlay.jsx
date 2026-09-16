/**
 * CrisisOverlay — Full-screen visual overlay that activates during crisis.
 * Vignette + warning banner + animated state machine text.
 */
export default function CrisisOverlay({ isCrisis, load }) {
  if (!isCrisis) return null;

  const loadPct = Math.min((load / 425) * 100, 100);
  const phase =
    load < 390 ? "DETECTED" :
    load < 405 ? "ANALYZING" :
    load < 415 ? "INTERVENTION" :
    "STABILIZING";

  const phaseColor = {
    DETECTED:     "#FF3CAC",
    ANALYZING:    "#FF7A00",
    INTERVENTION: "#8B5CF6",
    STABILIZING:  "#C8FF38",
  }[phase];

  const steps = [
    { label: "DETECTED",     done: true },
    { label: "ANALYZED",     done: load >= 390 },
    { label: "INTERVENTION", done: load >= 405 },
    { label: "STABILIZED",   done: load < 390 },
  ];

  return (
    <>
      {/* Vignette overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(255,60,172,0.12) 100%)",
          animation: "crisis-flash 0.8s ease-in-out infinite",
        }}
      />

      {/* Top warning banner */}
      <div
        className="fixed top-[60px] left-0 right-0 z-50 flex items-center justify-center py-2"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,60,172,0.15) 20%, rgba(255,60,172,0.15) 80%, transparent)",
          borderBottom: "1px solid rgba(255,60,172,0.3)",
          animation: "rise-in 0.4s ease-out",
        }}
      >
        <div className="flex items-center gap-6">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.3em]"
            style={{ color: "#FF3CAC", textShadow: "0 0 12px rgba(255,60,172,0.8)" }}
          >
            ⚠ CRISIS SIMULATION ACTIVE
          </span>
          <span className="h-3 w-px" style={{ background: "rgba(255,60,172,0.3)" }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: phaseColor }}
          >
            PHASE: {phase}
          </span>
          <span className="h-3 w-px" style={{ background: "rgba(255,60,172,0.3)" }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: loadPct > 95 ? "#FF3CAC" : "#FF7A00" }}
          >
            LOAD: {loadPct.toFixed(1)}% OF CAPACITY
          </span>
        </div>
      </div>

      {/* Crisis state machine — bottom right */}
      <div
        className="fixed bottom-6 right-6 z-50 rounded-xl px-5 py-4"
        style={{
          background: "rgba(9,7,13,0.95)",
          border: "1px solid rgba(255,60,172,0.25)",
          boxShadow: "0 0 40px rgba(255,60,172,0.15)",
          backdropFilter: "blur(16px)",
          minWidth: 220,
          animation: "rise-in 0.4s ease-out",
        }}
      >
        <div className="font-mono text-[8px] uppercase tracking-[0.25em] mb-3" style={{ color: "rgba(247,247,242,0.3)" }}>
          Autonomous Response
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <span
                className="font-mono text-xs"
                style={{
                  color: step.done ? "#C8FF38" : "rgba(247,247,242,0.2)",
                  textShadow: step.done ? "0 0 8px rgba(200,255,56,0.5)" : "none",
                  transition: "color 0.4s ease",
                }}
              >
                {step.done ? "✓" : "○"}
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.15em]"
                style={{
                  color: step.done ? "#C8FF38" : "rgba(247,247,242,0.2)",
                  transition: "color 0.4s ease",
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Load bar */}
        <div className="mt-3">
          <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${loadPct}%`,
                background: "linear-gradient(90deg, #FF7A00, #FF3CAC)",
                boxShadow: "0 0 8px rgba(255,60,172,0.6)",
                transition: "width 0.7s ease",
              }}
            />
          </div>
          <div className="flex justify-between mt-1 font-mono text-[8px]" style={{ color: "rgba(247,247,242,0.25)" }}>
            <span>0</span>
            <span style={{ color: "#FF3CAC" }}>{load} kW</span>
            <span>425</span>
          </div>
        </div>
      </div>
    </>
  );
}
