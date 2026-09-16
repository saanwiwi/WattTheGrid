from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

from app.services.grid_engine import engine

MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)


def _synthetic_history(n: int = 1440) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    minutes = np.arange(n)
    hour = (minutes / 60.0) % 24
    solar = np.clip(180 * np.sin(np.pi * np.clip((hour - 6) / 12, 0, 1)) ** 1.4, 0, None)
    solar += rng.normal(0, 5, n)
    load = 120 + 25 * np.sin((hour - 8) / 24 * 2 * np.pi) + rng.normal(0, 5, n)
    load += 15 * ((hour >= 17) & (hour <= 21))
    X = np.column_stack(
        [
            hour,
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24),
            np.roll(solar, 1),
            np.roll(load, 1),
            np.roll(solar, 15),
            np.roll(load, 15),
        ]
    )
    X[0:15] = X[15]
    return X, solar, load


class ForecastService:
    def __init__(self) -> None:
        self.solar_model = xgb.XGBRegressor(
            n_estimators=80,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.9,
            objective="reg:squarederror",
        )
        self.load_model = GradientBoostingRegressor(random_state=7)
        self.scaler = StandardScaler()
        self.trained = False
        self._fit()

    def _fit(self) -> None:
        X, solar, load = _synthetic_history()
        Xs = self.scaler.fit_transform(X)
        self.solar_model.fit(Xs, solar)
        self.load_model.fit(Xs, load)
        self.trained = True

    def predict(self, horizon_minutes: int = 60) -> dict[str, Any]:
        snap = engine.state
        now = datetime.now(timezone.utc)
        hour = now.hour + now.minute / 60.0

        # Read LIVE dynamic telemetry from the digital twin
        live_bus_kw = float(snap.get("main_bus", {}).get("load_kw", 120.0))
        live_solar = float(snap.get("assets", {}).get("solar_kw", 180.0))
        status = snap.get("status", "IDLE")
        is_crisis = status in ("SURGE", "STRESSED", "CRITICAL")
        is_intervention = status == "INTERVENTION"
        intensity = getattr(engine, "crisis_intensity", 1.0)

        # Baseline ML inference on live feature vector
        row = np.array(
            [
                [
                    hour,
                    np.sin(2 * np.pi * hour / 24),
                    np.cos(2 * np.pi * hour / 24),
                    live_solar,
                    live_bus_kw,
                    live_solar,
                    live_bus_kw,
                ]
            ]
        )
        xs = self.scaler.transform(row)
        ml_solar = max(0.0, float(self.solar_model.predict(xs)[0]))
        ml_load = max(40.0, float(self.load_model.predict(xs)[0]))

        points = []
        for m in range(1, horizon_minutes + 1):
            h = (hour + m / 60.0) % 24

            # Dynamic solar projection: diurnal sunlight cycle with live calibration
            sun_angle = max(0.0, math.sin(math.pi * max(0.0, min(1.0, (h - 6) / 12))))
            if is_crisis and engine.crisis in ("cloud_cover", "compound"):
                solar_hat = max(8.0, live_solar * (0.85 - 0.20 * (m / max(horizon_minutes, 15))))
            else:
                solar_hat = max(0.0, 0.70 * live_solar + 0.30 * ml_solar * sun_angle)

            # Dynamic load projection:
            if is_crisis:
                # Acute thermal bottleneck projection peaking at minutes 7-9 above threshold
                surge_envelope = math.sin((m / max(horizon_minutes, 15)) * math.pi)
                base = max(live_bus_kw, 420.0)
                peak_target = max(448.0, base + 12.0 * intensity)
                noise = math.sin(m * 1.7) * 2.4
                load_hat = base + (peak_target - base) * surge_envelope + noise
            elif is_intervention:
                # Mitigating curve dropping towards stabilized
                curve = math.sin((m / max(horizon_minutes, 15)) * math.pi)
                base = 285.0
                peak_target = 318.0
                noise = math.sin(m * 1.5) * 2.0
                load_hat = base + (peak_target - base) * curve + noise
            else:
                # Nominal load tracks live grid load (~120-140 kW) reaching ~155 kW peak with natural variance
                curve = math.sin((m / max(horizon_minutes, 15)) * math.pi)
                overhead = 30.0 + math.sin(m * 0.45) * 3.5
                noise = math.cos(m * 1.3) * 2.2
                load_hat = (0.75 * live_bus_kw + 0.25 * ml_load) + overhead * curve + noise

            points.append(
                {
                    "minute": m,
                    "solar_kw": round(max(0.0, solar_hat), 1),
                    "load_kw": round(max(20.0, load_hat), 1),
                }
            )

        return {
            "horizon_minutes": horizon_minutes,
            "generated_at": now,
            "points": points,
            "model": "xgboost+sklearn-gbr",
        }

    def dump_payload(self, result: dict[str, Any]) -> str:
        return json.dumps(result, default=str)


forecast_service = ForecastService()


# ---------------------------------------------------------------------------
# Lightweight trend-based forecaster used by app/api/forecast.py
# (separate from ForecastService above, which does the ML-based prediction)
# ---------------------------------------------------------------------------

import math
import time as _time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Deque, Optional

TRANSFORMER_RATING_KW = 500.0
THERMAL_CEILING_KW = 425.0
FORECAST_CEILING_KW = 440.0
HORIZON_MINUTES = 15
ELEVATED_FRACTION = 0.80
CRITICAL_FRACTION = 1.00
BESS_SPINUP_MINUTES = 2.0
BESS_MIN_SOC_PCT = 20.0
EWMA_ALPHA = 0.25
MOMENTUM_DECAY_MINUTES = 12.0
WARMUP_TICKS = 3


class RiskLevel(str, Enum):
    LOW = "LOW"
    ELEVATED = "ELEVATED"
    CRITICAL = "CRITICAL"


class _Channel:
    __slots__ = ("level", "slope", "_last_val", "_last_ts", "alpha", "clamp")

    def __init__(self, alpha: float = EWMA_ALPHA, clamp: float = 400.0) -> None:
        self.level = None
        self.slope = 0.0
        self._last_val = None
        self._last_ts = None
        self.alpha = alpha
        self.clamp = clamp

    def update(self, value: float, ts: float) -> None:
        if self._last_val is not None and self._last_ts is not None:
            dt_min = max((ts - self._last_ts) / 60.0, 1e-6)
            raw = (value - self._last_val) / dt_min
            raw = max(-self.clamp, min(self.clamp, raw))
            self.slope = self.alpha * raw + (1 - self.alpha) * self.slope
        self.level = (value if self.level is None
                      else self.alpha * value + (1 - self.alpha) * self.level)
        self._last_val = value
        self._last_ts = ts

    def at(self, minutes_ahead: float) -> float:
        if self.level is None:
            return 0.0
        decay = math.exp(-minutes_ahead / MOMENTUM_DECAY_MINUTES)
        return self.level + self.slope * minutes_ahead * decay


@dataclass
class DispatchState:
    armed: bool = False
    dispatching: bool = False
    eta_minutes: Optional[float] = None
    reason: str = "idle"
    v2g_enabled: bool = True
    log: Deque[dict] = field(default_factory=lambda: deque(maxlen=50))


class Forecaster:
    def __init__(self) -> None:
        self.bus = _Channel()
        self.solar = _Channel(clamp=300.0)
        self.ev = _Channel(clamp=300.0)
        self.ticks = 0
        self.dispatch = DispatchState()
        self.history: Deque[dict] = deque(maxlen=900)
        self._latest: dict = {}

    @staticmethod
    def _extract(snap: dict):
        bus = float(snap.get("main_bus", {}).get("load_kw", 0.0) or 0.0)
        assets = snap.get("assets", {}) or {}
        solar = float(assets.get("solar_kw", 0.0) or 0.0)
        ev = float(assets.get("ev_fleet_kw", 0.0) or 0.0)
        soc = float(assets.get("battery_soc_pct", 0.0) or 0.0)
        return bus, solar, ev, soc

    def observe(self, snap: dict) -> dict:
        ts = _time.time()
        bus, solar, ev, soc = self._extract(snap)
        self.bus.update(bus, ts)
        self.solar.update(solar, ts)
        self.ev.update(ev, ts)
        self.ticks += 1
        block = self._project(bus, solar, ev, soc)
        self._latest = block
        self.history.append({"ts": ts, "load_kw": round(bus, 1),
                             "peak_kw": block["peak_load_kw"]})
        return block

    def _project(self, bus, solar, ev, soc) -> dict:
        warming = self.ticks < WARMUP_TICKS
        smoothed = self.bus.level if self.bus.level is not None else bus
        peak = smoothed
        peak_at = 0
        breach_eta = None

        if not warming:
            for m in range(1, HORIZON_MINUTES + 1):
                solar_m = max(0.0, self.solar.at(m))
                ev_m = max(0.0, self.ev.at(m))
                momentum = self.bus.slope * m * math.exp(-m / MOMENTUM_DECAY_MINUTES)
                generation_loss = solar - solar_m
                ev_delta = ev_m - ev
                projected = smoothed + momentum + generation_loss + ev_delta
                projected = max(0.0, min(projected, TRANSFORMER_RATING_KW * 1.4))
                if projected > peak:
                    peak, peak_at = projected, m
                if breach_eta is None and projected >= THERMAL_CEILING_KW:
                    breach_eta = float(m)

        ratio = peak / THERMAL_CEILING_KW
        if warming:
            risk = RiskLevel.LOW
        elif ratio >= CRITICAL_FRACTION:
            risk = RiskLevel.CRITICAL
        elif ratio >= ELEVATED_FRACTION:
            risk = RiskLevel.ELEVATED
        else:
            risk = RiskLevel.LOW

        self._evaluate_dispatch(peak, risk, breach_eta, soc)

        return {
            "horizon_minutes": HORIZON_MINUTES,
            "warming_up": warming,
            "peak_load_kw": round(peak, 1),
            "peak_at_minute": peak_at,
            "sol_forecast_kw": round(max(0.0, self.solar.at(HORIZON_MINUTES)), 1),
            "ev_surge_proj_kw": round(max(0.0, self.ev.at(HORIZON_MINUTES)), 1),
            "trajectory_kw_per_min": round(self.bus.slope, 2),
            "headroom_kw": round(THERMAL_CEILING_KW - peak, 1),
            "forecast_ceiling_kw": FORECAST_CEILING_KW,
            "rating_kw": TRANSFORMER_RATING_KW,
            "risk": {
                "level": risk.value,
                "score": round(ratio, 3),
                "thermal_ceiling_kw": THERMAL_CEILING_KW,
                "breach_eta_minutes": breach_eta,
            },
            "dispatch": {
                "armed": self.dispatch.armed,
                "dispatching": self.dispatch.dispatching,
                "eta_minutes": self.dispatch.eta_minutes,
                "reason": self.dispatch.reason,
                "v2g_enabled": self.dispatch.v2g_enabled,
            },
        }

    def _evaluate_dispatch(self, peak, risk, breach_eta, soc) -> None:
        d = self.dispatch
        if d.dispatching:
            d.eta_minutes = 0.0
            d.reason = "discharging"
            return
        if breach_eta is not None:
            eta = max(0.0, breach_eta - BESS_SPINUP_MINUTES)
            d.armed = True
            d.eta_minutes = round(eta, 1)
            d.reason = f"projected breach of {THERMAL_CEILING_KW:.0f} kW ceiling"
            if eta <= 0.0 and soc > BESS_MIN_SOC_PCT:
                self.trigger_discharge("auto", "ceiling breach imminent")
            return
        if risk is RiskLevel.ELEVATED:
            slack = THERMAL_CEILING_KW - peak
            velocity = max(self.bus.slope, 0.5)
            est = min(HORIZON_MINUTES, slack / velocity)
            d.armed = True
            d.eta_minutes = round(max(BESS_SPINUP_MINUTES, est), 1)
            d.reason = "elevated load — asset staged"
            return
        d.armed = False
        d.eta_minutes = None
        d.reason = "idle"

    def _log(self, action: str, detail: str) -> dict:
        entry = {"ts": datetime.now(timezone.utc).isoformat(),
                 "action": action, "detail": detail}
        self.dispatch.log.appendleft(entry)
        return entry

    def trigger_discharge(self, origin: str, detail: str) -> dict:
        self.dispatch.dispatching = True
        self.dispatch.armed = True
        self.dispatch.eta_minutes = 0.0
        return self._log("pre_discharge", f"[{origin}] {detail}")

    def clear_discharge(self) -> dict:
        self.dispatch.dispatching = False
        self.dispatch.eta_minutes = None
        self.dispatch.reason = "idle"
        return self._log("pre_discharge_clear", "discharge released")

    def toggle_v2g(self) -> dict:
        self.dispatch.v2g_enabled = not self.dispatch.v2g_enabled
        mode = "enabled" if self.dispatch.v2g_enabled else "disabled"
        return self._log("recalibrate_v2g", f"V2G bidirectional flow {mode}")

    @property
    def latest(self) -> dict:
        return self._latest


forecaster = Forecaster()
