import { useState, useRef, useEffect } from "react";
import { GRID_NODES, GRID_EDGES } from "../data/gridData";

/**
 * GridScene — SVG-based interactive microgrid topology.
 * Shows nodes, animated energy-flow lines, and particle effects.
 * Hovering a node highlights its connections and shows telemetry.
 */
export default function GridScene({ load, isCrisis }) {
  const [hovered, setHovered] = useState(null);
  const [particles, setParticles] = useState([]);
  const svgRef = useRef(null);
  const particleId = useRef(0);

  // Build lookup for node positions
  const nodeMap = {};
  GRID_NODES.forEach((n) => { nodeMap[n.id] = n; });

  // Convert % coords to SVG viewBox coords (viewBox="0 0 100 100")
  const nx = (n) => n.x;
  const ny = (n) => n.y;

  const hoveredNode = hovered ? nodeMap[hovered] : null;

  const isEdgeActive = (edge) => {
    if (!hovered) return true;
    return edge.from === hovered || edge.to === hovered;
  };

  const isNodeActive = (nodeId) => {
    if (!hovered) return true;
    if (nodeId === hovered) return true;
    return GRID_EDGES.some(
      (e) => (e.from === hovered && e.to === nodeId) || (e.to === hovered && e.from === nodeId)
    );
  };

  // Spawn particles along edges
  useEffect(() => {
    const interval = setInterval(() => {
      const edgeIdx = Math.floor(Math.random() * GRID_EDGES.length);
      const edge = GRID_EDGES[edgeIdx];
      const id = particleId.current++;
      setParticles((prev) => [
        ...prev.filter((p) => Date.now() - p.born < 2200),
        { id, edge, born: Date.now(), progress: 0, speed: 0.6 + Math.random() * 0.4 },
      ]);
    }, 280);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let raf;
    const animate = () => {
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, progress: p.progress + p.speed * 0.012 }))
          .filter((p) => p.progress < 1)
      );
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Compute particle position along an edge
  const getParticlePos = (edge, progress) => {
    const from = nodeMap[edge.from];
    const to = nodeMap[edge.to];
    if (!from || !to) return { x: 0, y: 0 };
    return {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };
  };

  // Crisis color override
  const edgeColor = (edge) => {
    if (isCrisis && (edge.from === "bus" || edge.to === "bus" || edge.from === "transformer" || edge.to === "transformer")) {
      return "#FF3CAC";
    }
    return edge.color;
  };

  return (
    <div className="relative w-full" style={{ minHeight: 360 }}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="w-full"
        style={{ height: 360, overflow: "visible" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glows per color */}
          <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-pink" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-lime" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-violet" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-crisis" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ─── Edges ─────────────────────────────────────────── */}
        {GRID_EDGES.map((edge, i) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;
          const active = isEdgeActive(edge);
          const color = edgeColor(edge);
          return (
            <g key={i}>
              {/* Base line */}
              <line
                x1={nx(from)} y1={ny(from)} x2={nx(to)} y2={ny(to)}
                stroke={color}
                strokeWidth={edge.width * 0.35}
                strokeOpacity={active ? 0.15 : 0.04}
                style={{ transition: "stroke-opacity 0.4s ease" }}
              />
              {/* Animated dashed flow */}
              <line
                x1={nx(from)} y1={ny(from)} x2={nx(to)} y2={ny(to)}
                stroke={color}
                strokeWidth={edge.width * 0.35}
                strokeOpacity={active ? (isCrisis ? 0.9 : 0.6) : 0.08}
                strokeDasharray="2.5 3.5"
                style={{
                  strokeDashoffset: 0,
                  animation: `energy-flow ${isCrisis ? "0.7s" : "1.8s"} linear infinite`,
                  transition: "stroke-opacity 0.4s ease",
                }}
              />
            </g>
          );
        })}

        {/* ─── Particles ─────────────────────────────────────── */}
        {particles.map((p) => {
          const pos = getParticlePos(p.edge, p.progress);
          const color = edgeColor(p.edge);
          const edgeActive = isEdgeActive(p.edge);
          return (
            <circle
              key={p.id}
              cx={pos.x}
              cy={pos.y}
              r={0.9}
              fill={color}
              opacity={edgeActive ? (isCrisis ? 0.95 : 0.8) : 0.15}
              filter={`url(#glow-${getFilterId(color)})`}
            />
          );
        })}

        {/* ─── Nodes ─────────────────────────────────────────── */}
        {GRID_NODES.map((node) => {
          const active = isNodeActive(node.id);
          const isHovered = hovered === node.id;
          const isXfmr = node.id === "transformer";
          const crisisNode = isCrisis && (isXfmr || node.id === "bus");
          const color = crisisNode ? "#FF3CAC" : node.color;
          const r = isXfmr ? 5 : (node.id === "bus" ? 4.5 : 3.5);

          return (
            <g
              key={node.id}
              transform={`translate(${nx(node)}, ${ny(node)})`}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Outer glow ring — always present, brightest on hover */}
              <circle
                r={r + 3}
                fill="none"
                stroke={color}
                strokeWidth={0.3}
                opacity={isHovered ? 0.6 : active ? 0.15 : 0.04}
                style={{ transition: "opacity 0.3s ease" }}
              />
              {/* Pulse ring on hover */}
              {isHovered && (
                <circle
                  r={r + 5}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.3}
                  style={{
                    opacity: 0,
                    animation: "pulse-ring 1.5s ease-out infinite",
                  }}
                />
              )}
              {/* Node body */}
              <circle
                r={r}
                fill={isHovered ? color : crisisNode ? "rgba(255,60,172,0.2)" : `${color}22`}
                stroke={color}
                strokeWidth={isHovered ? 0.6 : 0.4}
                opacity={active ? 1 : 0.25}
                filter={isHovered || crisisNode ? `url(#glow-${getFilterId(color)})` : undefined}
                style={{ transition: "all 0.3s ease" }}
              />
              {/* Node icon text */}
              <text
                y={-r - 1.8}
                textAnchor="middle"
                fill={active ? color : "rgba(255,255,255,0.2)"}
                fontSize="2.2"
                fontFamily="Space Grotesk, sans-serif"
                fontWeight="600"
                letterSpacing="0.08em"
                style={{ transition: "fill 0.3s ease" }}
              >
                {node.label}
              </text>
              <text
                y={r + 2.8}
                textAnchor="middle"
                fill={active ? "rgba(247,247,242,0.55)" : "rgba(255,255,255,0.12)"}
                fontSize="1.8"
                fontFamily="JetBrains Mono, monospace"
                style={{ transition: "fill 0.3s ease" }}
              >
                {node.id === "transformer" ? `${load} kW` : node.sublabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ─── Node Tooltip ───────────────────────────────────── */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0"
          style={{ zIndex: 20 }}
        >
          <div
            className="rounded-lg px-4 py-3 text-center"
            style={{
              background: "rgba(17,16,25,0.95)",
              border: `1px solid ${hoveredNode.color}44`,
              boxShadow: `0 0 24px ${hoveredNode.glow}`,
              backdropFilter: "blur(12px)",
              animation: "rise-in 0.2s ease-out",
              minWidth: 180,
            }}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "rgba(247,247,242,0.4)" }}>
              {hoveredNode.description}
            </div>
            <div className="mt-2 flex justify-center gap-4">
              {hoveredNode.stats.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="font-mono text-xs font-500" style={{ color: hoveredNode.color }}>{s.value}</div>
                  <div className="font-mono text-[8px] uppercase tracking-wider" style={{ color: "rgba(247,247,242,0.3)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getFilterId(color) {
  if (color === "#FF7A00" || color.includes("122,0")) return "orange";
  if (color === "#315CFF" || color.includes("49,92")) return "blue";
  if (color === "#FF3CAC" || color.includes("255,60")) return "pink";
  if (color === "#C8FF38" || color.includes("200,255")) return "lime";
  if (color === "#8B5CF6" || color.includes("139,92")) return "violet";
  return "blue";
}
