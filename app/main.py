from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.auth import router as auth_router
from app.api.grid import router as grid_router
from app.api.intelligence import router as intel_router
from app.config import get_settings
from app.database import Base, SessionLocal, engine as db_engine
from app.models import EventSeverity, GridEvent, TelemetrySample
from app.services import hub
from app.services.grid_engine import engine
from app.services.mqtt_ingest import publish_twin, start_mqtt, stop_mqtt
from app.services.seed import seed_if_empty

settings = get_settings()


async def twin_loop() -> None:
    n = 0
    while True:
        snap = engine.step()
        await hub.broadcast(json.loads(json.dumps(snap, default=str)))
        publish_twin(snap)
        n += 1
        if n % settings.persist_telemetry_every_n_ticks == 0:
            async with SessionLocal() as db:
                db.add(
                    TelemetrySample(
                        asset_id="SUB-01",
                        ts=datetime.now(timezone.utc),
                        power_kw=snap["main_bus"]["load_kw"],
                        voltage_v=415.0,
                        frequency_hz=snap["main_bus"]["frequency_hz"],
                        extra_json=json.dumps(
                            {
                                "solar_kw": snap["assets"]["solar_kw"],
                                "ev_kw": snap["assets"]["ev_fleet_kw"],
                                "factory_kw": snap["assets"]["factory_kw"],
                                "soc": snap["assets"]["battery_soc_pct"],
                                "status": snap["status"],
                            }
                        ),
                    )
                )
                if n % 30 == 0:
                    db.add(
                        GridEvent(
                            ts=datetime.now(timezone.utc),
                            code="TICK",
                            message=f"BUS {snap['main_bus']['load_kw']} kW | {snap['status']}",
                            severity=EventSeverity.INFO,
                            source="engine",
                        )
                    )
                await db.commit()
        await asyncio.sleep(settings.tick_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path("data").mkdir(exist_ok=True)
    Path("models").mkdir(exist_ok=True)
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await seed_if_empty(db)
    loop = asyncio.get_running_loop()
    start_mqtt(loop)
    task = asyncio.create_task(twin_loop())
    yield
    task.cancel()
    stop_mqtt()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="WattTheGrid",
    description="Digital twin and AI microgrid control plane for WHAT THE GRID.",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(grid_router, prefix="/api/v1")
app.include_router(intel_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {
        "ok": True,
        "sys_id": settings.sys_id,
        "version": __version__,
        "status": engine.state.get("status"),
        "tick": engine.tick,
    }
