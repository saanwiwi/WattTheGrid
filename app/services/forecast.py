from __future__ import annotations

import json
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
    solar = np.clip(210 * np.sin(np.pi * np.clip((hour - 6) / 12, 0, 1)) ** 1.4, 0, None)
    solar += rng.normal(0, 6, n)
    load = 280 + 70 * np.sin((hour - 8) / 24 * 2 * np.pi) + rng.normal(0, 12, n)
    load += 40 * ((hour >= 17) & (hour <= 21))
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
        last_solar = float(snap["assets"]["solar_kw"])
        last_load = float(
            snap["assets"]["ev_fleet_kw"] + snap["assets"]["factory_kw"] + 38.0
        )
        points = []
        solar_hist = last_solar
        load_hist = last_load
        for m in range(1, horizon_minutes + 1):
            h = (hour + m / 60.0) % 24
            row = np.array(
                [
                    [
                        h,
                        np.sin(2 * np.pi * h / 24),
                        np.cos(2 * np.pi * h / 24),
                        solar_hist,
                        load_hist,
                        last_solar,
                        last_load,
                    ]
                ]
            )
            xs = self.scaler.transform(row)
            solar_hat = max(0.0, float(self.solar_model.predict(xs)[0]))
            load_hat = max(40.0, float(self.load_model.predict(xs)[0]))
            # blend live twin into the forecast so the UI stays coherent
            solar_hat = 0.55 * solar_hat + 0.45 * last_solar
            load_hat = 0.55 * load_hat + 0.45 * last_load
            solar_hist, load_hist = solar_hat, load_hat
            points.append(
                {
                    "minute": m,
                    "solar_kw": round(solar_hat, 1),
                    "load_kw": round(load_hat, 1),
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
