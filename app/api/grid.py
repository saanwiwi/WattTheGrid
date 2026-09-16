import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EventSeverity, GridAsset, GridEvent, TelemetrySample
from app.schemas import CrisisRequest, GridSnapshot, IoTIngest
from app.services import hub
from app.services.grid_engine import engine

router = APIRouter(tags=["grid"])


def _snapshot() -> GridSnapshot:
    return GridSnapshot.model_validate(engine.state)


@router.get("/grid/snapshot", response_model=GridSnapshot)
async def snapshot():
    return _snapshot()


@router.get("/grid/assets")
async def list_assets(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select

    rows = (await db.execute(select(GridAsset))).scalars().all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "asset_type": a.asset_type.value,
            "lat": a.lat,
            "lng": a.lng,
            "rated_kw": a.rated_kw,
            "mqtt_topic": a.mqtt_topic,
            "is_online": a.is_online,
        }
        for a in rows
    ]


@router.get("/grid/events")
async def events(limit: int = Query(50, le=200)):
    return engine.events[-limit:]


@router.post("/crisis/simulate", response_model=GridSnapshot)
async def simulate_crisis(body: CrisisRequest, db: AsyncSession = Depends(get_db)):
    engine.apply_crisis(body.scenario, body.intensity, body.autonomous)
    db.add(
        GridEvent(
            ts=datetime.now(timezone.utc),
            code="HAZARD_TRIG",
            message=f"SIMULATE CRISIS: {body.scenario} intensity={body.intensity}",
            severity=EventSeverity.CRITICAL,
            source="api",
        )
    )
    await db.commit()
    return GridSnapshot.model_validate(engine.step())


@router.post("/crisis/reset", response_model=GridSnapshot)
async def reset_baseline(db: AsyncSession = Depends(get_db)):
    engine.reset()
    db.add(
        GridEvent(
            ts=datetime.now(timezone.utc),
            code="RESET",
            message="RESET BASELINE",
            severity=EventSeverity.INFO,
            source="api",
        )
    )
    await db.commit()
    return GridSnapshot.model_validate(engine.step())


@router.post("/iot/ingest")
async def iot_ingest(body: IoTIngest, db: AsyncSession = Depends(get_db)):
    engine.ingest_iot(body.asset_id, body.power_kw, body.soc_pct)
    sample = TelemetrySample(
        asset_id=body.asset_id,
        ts=datetime.now(timezone.utc),
        power_kw=body.power_kw,
        voltage_v=body.voltage_v,
        frequency_hz=body.frequency_hz,
        soc_pct=body.soc_pct,
        temperature_c=body.temperature_c,
        extra_json=json.dumps(body.extra),
    )
    db.add(sample)
    await db.commit()
    return {"ok": True, "tick": engine.tick}


@router.websocket("/ws/grid")
async def grid_ws(ws: WebSocket):
    await hub.connect(ws)
    try:
        await ws.send_text(json.dumps(engine.state, default=str))
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(ws)
    except Exception:
        await hub.disconnect(ws)
