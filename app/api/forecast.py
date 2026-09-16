"""Forecast API — mounted alongside grid/intelligence under /api/v1."""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from app.services.forecast import forecaster

router = APIRouter(prefix="/grid-forecast", tags=["grid-forecast"])


@router.get("")
async def get_forecast() -> dict:
    """Current 15-minute projection. Mirrors the block embedded in the
    websocket snapshot, for clients that would rather poll."""
    if not forecaster.latest:
        raise HTTPException(503, "forecast not primed — engine has not ticked yet")
    return forecaster.latest


@router.get("/history")
async def get_history(minutes: int = 30) -> dict:
    cutoff = time.time() - minutes * 60
    pts = [p for p in forecaster.history if p["ts"] >= cutoff]
    return {"points": pts, "count": len(pts)}


@router.get("/events")
async def get_events() -> dict:
    return {"events": list(forecaster.dispatch.log)}


@router.post("/actions/pre-discharge")
async def force_pre_discharge() -> dict:
    """FORCE PRE-DISCHARGE button."""
    event = forecaster.trigger_discharge("operator", "manual override from console")
    d = forecaster.dispatch
    return {"ok": True, "event": event,
            "dispatch": {"armed": d.armed, "dispatching": d.dispatching,
                        "eta_minutes": d.eta_minutes, "reason": d.reason,
                        "v2g_enabled": d.v2g_enabled}}


@router.post("/actions/pre-discharge/clear")
async def clear_pre_discharge() -> dict:
    event = forecaster.clear_discharge()
    return {"ok": True, "event": event}


@router.post("/actions/recalibrate-v2g")
async def recalibrate_v2g() -> dict:
    """RECALIBRATE V2G button."""
    event = forecaster.toggle_v2g()
    return {"ok": True, "event": event,
            "v2g_enabled": forecaster.dispatch.v2g_enabled}
