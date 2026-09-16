from __future__ import annotations

import math
import random
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from app.config import get_settings

CrisisKind = Optional[Literal["ev_surge", "cloud_cover", "blackout", "compound"]]


BASELINE: dict[str, Any] = {
    "sys_id": "WTG-09",
    "version": "AUTONOMOUS V4",
    "bus": "TX-400 MAIN BUS",
    "status": "IDLE",
    "headline": "WHAT THE GRID",
    "copy": (
        "THE GRID IS ALIVE. MODELING COMPOUND MICROGRID STRESSES IN REAL-TIME. "
        "SUB-SECOND EXECUTION LOGIC ENABLED."
    ),
    "main_bus": {
        "id": "TX-488",
        "load_kw": 120.0,
        "flow_kw": 120.0,
        "harmonic_thd": 1.8,
        "frequency_hz": 49.98,
        "impedance_ohm": 0.042,
        "state": "NOMINAL_FLOW",
        "field_state": "NOMINAL",
        "threshold_kw": 425.0,
        "max_kw": 500.0,
    },
    "assets": {
        "solar_kw": 182.0,
        "solar_efficiency": 96.4,
        "ev_fleet_kw": 102.0,
        "ev_units": 4,
        "battery_soc_pct": 98.0,
        "battery_chemistry": "LFP CELL",
        "factory_kw": 200.0,
        "factory_load_pct": 68.0,
    },
    "topology": [
        {"id": "SUB-01", "label": "TX-400", "kind": "substation", "x": 0.0, "y": 0.6, "z": 0.0, "power_kw": 120.0, "stress": 0.24, "online": True},
        {"id": "PV-EAST", "label": "SOLAR ARRAY", "kind": "solar_home", "x": -0.8, "y": 0.2, "z": 0.4, "power_kw": 182.0, "stress": 0.18, "online": True},
        {"id": "EV-HUB", "label": "EV FLEET", "kind": "ev_hub", "x": 0.85, "y": 0.15, "z": 0.35, "power_kw": 102.0, "stress": 0.35, "online": True},
        {"id": "FAC-01", "label": "FACTORY", "kind": "factory", "x": 0.1, "y": -0.05, "z": -0.7, "power_kw": 200.0, "stress": 0.68, "online": True},
        {"id": "BESS-1", "label": "BESS CELL", "kind": "bess", "x": -0.35, "y": 0.05, "z": -0.25, "power_kw": -18.0, "stress": 0.12, "online": True},
    ],
}


class GridEngine:
    """Deterministic-ish digital twin of the TX-400 community microgrid."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.tick = 0
        self.crisis: CrisisKind = None
        self.crisis_intensity = 1.0
        self.crisis_tick = 0
        self.autonomous = True
        self._rng = random.Random(400)
        self.state = deepcopy(BASELINE)
        self.events: list[dict[str, Any]] = [
            {
                "ts": datetime.now(timezone.utc),
                "code": "BOOT",
                "message": "AUTO-CONTROL LOOP INITIALIZED",
                "severity": "info",
            },
            {
                "ts": datetime.now(timezone.utc),
                "code": "BESS_OK",
                "message": "BESS CELL BALANCE: OK",
                "severity": "info",
            },
            {
                "ts": datetime.now(timezone.utc),
                "code": "PV_TEMP",
                "message": "SOLAR ARRAY TEMP: 38°C — NOMINAL",
                "severity": "info",
            },
            {
                "ts": datetime.now(timezone.utc),
                "code": "VREG",
                "message": "VOLTAGE_REG: 415V NOMINAL",
                "severity": "info",
            },
        ]
        self.advisor: dict[str, Any] = {
            "mode": "STANDBY",
            "recommendation": "Maintain nominal P2P balancing. No V2G required.",
            "actions": [],
        }

    def log(self, code: str, message: str, severity: str = "info") -> None:
        self.events.append(
            {
                "ts": datetime.now(timezone.utc),
                "code": code,
                "message": message,
                "severity": severity,
            }
        )
        self.events = self.events[-40:]

    def reset(self) -> None:
        self.crisis = None
        self.crisis_intensity = 1.0
        self.crisis_tick = 0
        self.state = deepcopy(BASELINE)
        self.state["status"] = "IDLE"
        self.state["crisis"] = None
        self.log("RESET", "OPERATOR COMMAND: BASELINE RESTORED // SYSTEM NOMINAL", "info")
        self.advisor = {
            "mode": "STANDBY",
            "recommendation": "Maintain nominal P2P balancing. No V2G required.",
            "actions": [],
        }

    def apply_crisis(self, scenario: CrisisKind, intensity: float, autonomous: bool) -> None:
        self.crisis = scenario
        self.crisis_intensity = intensity
        self.autonomous = autonomous
        self.crisis_tick = 0
        self.state["status"] = "SURGE"
        self.state["crisis"] = scenario
        self.log("HAZARD_TRIG", "SURGE DETECTED — CLOUD COVER + EV SPIKE", "critical")

    def ingest_iot(self, asset_id: str, power_kw: float, soc_pct: Optional[float] = None) -> None:
        assets = self.state["assets"]
        mapping = {
            "PV-EAST": "solar_kw",
            "EV-HUB": "ev_fleet_kw",
            "FAC-01": "factory_kw",
            "BESS-1": None,
        }
        key = mapping.get(asset_id)
        if key:
            assets[key] = power_kw
        if asset_id == "BESS-1" and soc_pct is not None:
            assets["battery_soc_pct"] = soc_pct
        for node in self.state["topology"]:
            if node["id"] == asset_id:
                node["power_kw"] = power_kw
                break
        self.log("MQTT", f"TELEMETRY {asset_id}: {power_kw:.1f} kW", "info")

    def _modifiers(self) -> dict[str, float]:
        i = self.crisis_intensity
        solar = 1.0
        ev = 1.0
        factory = 1.0
        islanded = False
        if self.crisis == "ev_surge":
            ev = 1.0 + 1.35 * i
        elif self.crisis == "cloud_cover":
            solar = max(0.12, 1.0 - 0.72 * i)
        elif self.crisis == "blackout":
            islanded = True
            factory = 0.55
        elif self.crisis == "compound":
            ev = 1.0 + 1.1 * i
            solar = max(0.18, 1.0 - 0.55 * i)
            islanded = True
            factory = 0.7
        return {"solar": solar, "ev": ev, "factory": factory, "islanded": float(islanded)}

    def step(self) -> dict[str, Any]:
        self.tick += 1
        t = self.tick
        m = self._modifiers()
        noise = lambda amp: self._rng.uniform(-amp, amp)

        solar = max(8.0, BASELINE["assets"]["solar_kw"] * m["solar"] + noise(4.0))
        # diurnal-ish modulation around the live dashboard number
        hour_wave = 0.08 * math.sin(t / 40.0)
        solar *= 1.0 + hour_wave

        ev = max(12.0, BASELINE["assets"]["ev_fleet_kw"] * m["ev"] + noise(6.0))
        factory = max(40.0, BASELINE["assets"]["factory_kw"] * m["factory"] + noise(5.0))

        homes = 38.0 + noise(3.0)
        load = ev + factory + homes
        surplus = solar - load

        soc = self.state["assets"]["battery_soc_pct"]
        bess_kw = 0.0
        v2g_kw = 0.0

        if surplus > 8 and soc < 99.2:
            bess_kw = -min(45.0, surplus * 0.55)
        elif surplus < -12 and soc > 18:
            bess_kw = min(70.0, -surplus * 0.5)

        islanded = bool(m["islanded"])
        if islanded and (load - solar + bess_kw) > 15 and self.autonomous:
            v2g_kw = min(ev * 0.35, load - solar + bess_kw)
            ev = max(0.0, ev - v2g_kw)
            self.advisor = {
                "mode": "AUTONOMOUS",
                "recommendation": "Execute V2G discharge and islanded P2P load shedding on factory non-critical feeders.",
                "actions": [
                    {"type": "v2g_discharge", "kw": round(v2g_kw, 1)},
                    {"type": "factory_shed", "kw": 40 if self.crisis == "compound" else 20},
                    {"type": "p2p_balance", "enabled": True},
                ],
            }
        elif self.crisis == "cloud_cover":
            self.advisor = {
                "mode": "ADVISORY",
                "recommendation": "Ramp BESS discharge; defer EV sessions 12 minutes; hold factory at 68%.",
                "actions": [
                    {"type": "bess_discharge", "kw": round(max(bess_kw, 25), 1)},
                    {"type": "ev_defer", "minutes": 12},
                ],
            }
        elif self.crisis == "ev_surge":
            self.advisor = {
                "mode": "ADVISORY",
                "recommendation": "Stagger rapid-charge bays; export surplus solar to EV hub via P2P.",
                "actions": [
                    {"type": "ev_stagger", "bays": 2},
                    {"type": "p2p_route", "from": "PV-EAST", "to": "EV-HUB"},
                ],
            }
        else:
            self.advisor = {
                "mode": "STANDBY",
                "recommendation": "Maintain nominal P2P balancing. No V2G required.",
                "actions": [],
            }

        net = load - solar + bess_kw - v2g_kw
        if islanded:
            net = max(0.0, net)

        # Autonomous 3-phase crisis progression:
        # Phase 1 (ticks 1-3): SURGE — acute load spike past 425 kW threshold
        # Phase 2 (ticks 4-6): INTERVENTION — BESS & V2G mitigation, load drops to ~285 kW
        # Phase 3 (ticks 7-12): STABILIZED — autonomous balance restored at ~124 kW
        # Then gracefully transitions back to IDLE so crisis can be re-simulated anytime
        if self.crisis:
            self.crisis_tick += 1
            if self.crisis_tick <= 3:
                bus_kw = 442.0 + noise(4.0)
                status = "SURGE"
                flow_state = "OVERLOAD"
                field = "HAZARD"
                if self.crisis_tick == 1:
                    self.log("HAZARD_TRIG", "SURGE DETECTED — CLOUD COVER + EV SPIKE", "critical")
            elif self.crisis_tick <= 6:
                bus_kw = 285.0 + noise(3.0)
                status = "INTERVENTION"
                flow_state = "MITIGATING_FLOW"
                field = "INTERVENTION"
                if self.crisis_tick == 4:
                    self.log("INTERVENTION", "THROTTLING LOW-PRIORITY EVs: VAN-CHARLIE, VAN-DELTA", "warn")
                    self.log("P2P_ROUTE", "P2P ROUTE ESTABLISHED — BESS-01 TO EV-DEPOT", "info")
            elif self.crisis_tick <= 12:
                bus_kw = 124.0 + noise(2.0)
                status = "STABILIZED"
                flow_state = "STABILIZED_FLOW"
                field = "SAFE"
                if self.crisis_tick == 7:
                    self.log("STABILIZED", "GRID BALANCED AND STABILIZED // CAPACITY SAFE", "info")
            else:
                self.crisis = None
                self.crisis_tick = 0
                bus_kw = 120.0 + 6.0 * math.sin(t / 18.0) + noise(1.8)
                status = "IDLE"
                flow_state = "NOMINAL_FLOW"
                field = "NOMINAL"
        else:
            bus_kw = 120.0 + 6.0 * math.sin(t / 18.0) + noise(1.8)
            status = "IDLE"
            flow_state = "NOMINAL_FLOW"
            field = "NOMINAL"

        freq = 50.0 - (bus_kw - 120.0) * 0.0024 + noise(0.01)
        if islanded:
            freq -= 0.18 * self.crisis_intensity
        thd = 1.8 + (0.9 if self.crisis else 0.0) + abs(noise(0.08))
        z = 0.042 + (0.011 if islanded else 0.0) + abs(noise(0.001))

        soc += (-bess_kw) / 850.0
        soc = max(8.0, min(100.0, soc))

        efficiency = max(72.0, 96.4 * m["solar"] + noise(0.4))
        factory_pct = min(100.0, 68.0 * m["factory"] + noise(0.8))

        assets = {
            "solar_kw": round(solar, 1),
            "solar_efficiency": round(efficiency, 1),
            "ev_fleet_kw": round(ev, 1),
            "ev_units": 4 if self.crisis != "ev_surge" else 7,
            "battery_soc_pct": round(soc, 1),
            "battery_chemistry": "LFP CELL",
            "factory_kw": round(factory, 1),
            "factory_load_pct": round(factory_pct, 1),
        }

        topology = deepcopy(BASELINE["topology"])
        power_map = {
            "SUB-01": bus_kw,
            "PV-EAST": solar,
            "EV-HUB": ev,
            "FAC-01": factory,
            "BESS-1": bess_kw,
        }
        for node in topology:
            node["power_kw"] = round(power_map[node["id"]], 1)
            node["stress"] = round(min(1.0, abs(node["power_kw"]) / max(node.get("rated", 250), 250)), 2)
            if node["id"] == "FAC-01":
                node["stress"] = round(min(1.0, factory_pct / 100.0), 2)
            if node["id"] == "EV-HUB":
                node["stress"] = round(min(1.0, ev / 280.0), 2)

        if t % 17 == 0:
            self.log("VREG", f"VOLTAGE_REG: {415 + noise(1.2):.0f}V NOMINAL", "info")
        if t % 23 == 0:
            self.log("PV_TEMP", f"SOLAR ARRAY TEMP: {38 + noise(2.5):.0f}°C — NOMINAL", "info")
        if self.crisis and t % 8 == 0:
            self.log("CTRL", self.advisor["recommendation"], "warn")

        snapshot = {
            "sys_id": self.settings.sys_id,
            "version": "AUTONOMOUS V4",
            "bus": f"{self.settings.bus_id} MAIN BUS",
            "status": status,
            "lat": self.settings.latitude,
            "lng": self.settings.longitude,
            "utc": datetime.now(timezone.utc),
            "live": True,
            "headline": "WHAT THE GRID",
            "copy": BASELINE["copy"],
            "main_bus": {
                "id": self.settings.load_bus_id,
                "load_kw": round(bus_kw, 1),
                "flow_kw": round(bus_kw, 1),
                "harmonic_thd": round(thd, 2),
                "frequency_hz": round(freq, 2),
                "impedance_ohm": round(z, 3),
                "state": flow_state,
                "field_state": field,
                "threshold_kw": 425.0,
                "max_kw": 500.0,
            },
            "assets": assets,
            "topology": topology,
            "events": list(self.events)[-12:],
            "advisor": self.advisor,
            "crisis": self.crisis,
            "tick": self.tick,
        }
        self.state = snapshot
        return snapshot


engine = GridEngine()
