// ─── Grid static data & initial state ───────────────────────────────────────

export const TRANSFORMER_CAPACITY = 425; // kW

export const initialChartData = [
  { time: "14:00", load: 282, solar: 118 },
  { time: "14:10", load: 296, solar: 124 },
  { time: "14:20", load: 311, solar: 131 },
  { time: "14:30", load: 325, solar: 137 },
  { time: "14:40", load: 341, solar: 142 },
  { time: "14:50", load: 356, solar: 149 },
  { time: "15:00", load: 368, solar: 154 },
];

export const initialLogs = [
  { time: "15:02:14", type: "SYSTEM", message: "Autonomous control loop initialized" },
  { time: "15:01:48", type: "BESS",   message: "Battery discharge rate adjusted to 42 kW" },
  { time: "15:01:12", type: "EV",     message: "Charging queue optimized — 7 vehicles active" },
  { time: "15:00:39", type: "SOLAR",  message: "Solar generation increased to 154 kW" },
  { time: "14:59:51", type: "GRID",   message: "Transformer load operating within limits" },
];

export const LOG_TYPE_COLOR = {
  ALERT:  "#FF3CAC",
  CRISIS: "#FF3CAC",
  AI:     "#8B5CF6",
  BESS:   "#315CFF",
  EV:     "#C8FF38",
  SOLAR:  "#FF7A00",
  GRID:   "#315CFF",
  SYSTEM: "#F7F7F2",
};

export const GRID_NODES = [
  {
    id: "solar",
    label: "SOLAR",
    sublabel: "154 kW",
    color: "#FF7A00",
    glow: "rgba(255,122,0,0.4)",
    x: 50,
    y: 6,
    description: "Solar Array · 188 kW peak",
    stats: [
      { label: "Generation", value: "154 kW" },
      { label: "Efficiency", value: "82%" },
      { label: "Panels", value: "312" },
    ],
  },
  {
    id: "bus",
    label: "GRID BUS",
    sublabel: "LIVE",
    color: "#315CFF",
    glow: "rgba(49,92,255,0.5)",
    x: 50,
    y: 38,
    description: "Main Distribution Bus",
    stats: [
      { label: "Voltage", value: "415 V" },
      { label: "Frequency", value: "49.98 Hz" },
      { label: "Phase", value: "3Φ" },
    ],
  },
  {
    id: "bess",
    label: "BESS",
    sublabel: "78% SOC",
    color: "#315CFF",
    glow: "rgba(49,92,255,0.4)",
    x: 14,
    y: 62,
    description: "Battery Energy Storage",
    stats: [
      { label: "SOC", value: "78%" },
      { label: "Discharge", value: "42 kW" },
      { label: "Capacity", value: "250 kWh" },
    ],
  },
  {
    id: "transformer",
    label: "XFMR",
    sublabel: "368 kW",
    color: "#FF3CAC",
    glow: "rgba(255,60,172,0.5)",
    x: 50,
    y: 62,
    description: "Main Distribution Transformer",
    stats: [
      { label: "Load", value: "368 kW" },
      { label: "Capacity", value: "425 kW" },
      { label: "Status", value: "Stable" },
    ],
  },
  {
    id: "ev",
    label: "EV HUB",
    sublabel: "7 active",
    color: "#C8FF38",
    glow: "rgba(200,255,56,0.4)",
    x: 86,
    y: 62,
    description: "EV Charging Hub",
    stats: [
      { label: "Charging", value: "4 units" },
      { label: "Queued", value: "3 units" },
      { label: "Load", value: "38 kW" },
    ],
  },
  {
    id: "factory",
    label: "FACTORY",
    sublabel: "214 kW",
    color: "#8B5CF6",
    glow: "rgba(139,92,246,0.4)",
    x: 50,
    y: 88,
    description: "Industrial Load · 3 clusters",
    stats: [
      { label: "Demand", value: "214 kW" },
      { label: "Clusters", value: "3 active" },
      { label: "Priority", value: "High" },
    ],
  },
];

// Topology connections [from, to, color, animated]
export const GRID_EDGES = [
  { from: "solar",       to: "bus",         color: "#FF7A00", width: 2 },
  { from: "bus",         to: "bess",        color: "#315CFF", width: 1.5 },
  { from: "bus",         to: "transformer", color: "#FF3CAC", width: 2.5 },
  { from: "bus",         to: "ev",          color: "#C8FF38", width: 1.5 },
  { from: "transformer", to: "factory",     color: "#8B5CF6", width: 2 },
];
