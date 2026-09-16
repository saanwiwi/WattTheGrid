from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    AssetType,
    EventSeverity,
    GridAsset,
    GridEvent,
    TradeStatus,
    User,
    UserRole,
    EnergyTrade,
)
from app.security import hash_password

ASSETS = [
    GridAsset(
        id="SUB-01",
        name="TX-400 Main Substation",
        asset_type=AssetType.SUBSTATION,
        lat=34.0522,
        lng=-118.2437,
        rated_kw=500,
        mqtt_topic="wtg/nodes/SUB-01/telemetry",
    ),
    GridAsset(
        id="PV-EAST",
        name="East Solar Array",
        asset_type=AssetType.SOLAR_HOME,
        lat=34.0531,
        lng=-118.2410,
        rated_kw=220,
        mqtt_topic="wtg/nodes/PV-EAST/telemetry",
    ),
    GridAsset(
        id="EV-HUB",
        name="Community EV Hub",
        asset_type=AssetType.EV_HUB,
        lat=34.0514,
        lng=-118.2462,
        rated_kw=280,
        mqtt_topic="wtg/nodes/EV-HUB/telemetry",
    ),
    GridAsset(
        id="FAC-01",
        name="Industrial Plant",
        asset_type=AssetType.FACTORY,
        lat=34.0501,
        lng=-118.2448,
        rated_kw=320,
        mqtt_topic="wtg/nodes/FAC-01/telemetry",
    ),
    GridAsset(
        id="BESS-1",
        name="LFP Community BESS",
        asset_type=AssetType.BESS,
        lat=34.0520,
        lng=-118.2440,
        rated_kw=70,
        mqtt_topic="wtg/nodes/BESS-1/telemetry",
    ),
]


async def seed_if_empty(db: AsyncSession) -> None:
    settings = get_settings()
    existing = await db.execute(select(User).limit(1))
    if existing.scalar_one_or_none():
        return

    admin = User(
        email=settings.demo_admin_email,
        hashed_password=hash_password(settings.demo_admin_password),
        full_name="Lead Operator",
        role=UserRole.ADMIN,
    )
    trader = User(
        email="peer@wattthegrid.local",
        hashed_password=hash_password(settings.demo_admin_password),
        full_name="P2P Trader",
        role=UserRole.TRADER,
    )
    db.add_all([admin, trader, *ASSETS])
    await db.flush()
    db.add(
        GridEvent(
            ts=datetime.now(timezone.utc),
            code="SEED",
            message="DEMO LEDGER AND ASSET REGISTRY INITIALIZED",
            severity=EventSeverity.INFO,
            source="seed",
        )
    )
    db.add(
        EnergyTrade(
            seller_id=admin.id,
            buyer_id=trader.id,
            kwh=12.5,
            price_per_kwh=0.11,
            status=TradeStatus.SETTLED,
            source_asset_id="PV-EAST",
            sink_asset_id="EV-HUB",
            settled_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
