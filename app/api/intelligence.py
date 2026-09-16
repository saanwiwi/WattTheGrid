from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EnergyTrade, ForecastRun, TradeStatus, User
from app.schemas import (
    ForecastOut,
    OptimizeOut,
    OptimizeRequest,
    TradeCreate,
    TradeOut,
)
from app.security import get_current_user
from app.services.forecast import forecast_service
from app.services.optimizer import optimize_schedule

router = APIRouter(tags=["intelligence"])


@router.get("/forecast", response_model=ForecastOut)
async def forecast(horizon_minutes: int = 60, db: AsyncSession = Depends(get_db)):
    result = forecast_service.predict(horizon_minutes)
    db.add(
        ForecastRun(
            ts=datetime.now(timezone.utc),
            horizon_minutes=horizon_minutes,
            kind="solar_load",
            payload_json=forecast_service.dump_payload(result),
        )
    )
    await db.commit()
    return result


@router.post("/optimize", response_model=OptimizeOut)
async def optimize(body: OptimizeRequest):
    try:
        return optimize_schedule(
            horizon_minutes=body.horizon_minutes,
            allow_v2g=body.allow_v2g,
            allow_p2p=body.allow_p2p,
            max_export_kw=body.max_export_kw,
        )
    except RuntimeError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.get("/trades", response_model=list[TradeOut])
async def list_trades(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EnergyTrade).order_by(EnergyTrade.id.desc()))).scalars().all()
    return rows


@router.post("/trades", response_model=TradeOut)
async def create_trade(
    body: TradeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    trade = EnergyTrade(
        seller_id=user.id,
        buyer_id=body.buyer_id,
        kwh=body.kwh,
        price_per_kwh=body.price_per_kwh,
        status=TradeStatus.OPEN,
        source_asset_id=body.source_asset_id,
        sink_asset_id=body.sink_asset_id,
    )
    db.add(trade)
    await db.commit()
    await db.refresh(trade)
    return trade


@router.post("/trades/{trade_id}/settle", response_model=TradeOut)
async def settle_trade(
    trade_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    trade = await db.get(EnergyTrade, trade_id)
    if trade is None:
        raise HTTPException(404, "Trade not found")
    trade.status = TradeStatus.SETTLED
    trade.settled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trade)
    return trade
