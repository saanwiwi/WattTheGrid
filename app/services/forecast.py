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
