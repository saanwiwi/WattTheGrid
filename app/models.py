from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, PyEnum):
    OPERATOR = "operator"
    ADMIN = "admin"
    TRADER = "trader"
    VIEWER = "viewer"


class AssetType(str, PyEnum):
    SOLAR_HOME = "solar_home"
    EV_HUB = "ev_hub"
    FACTORY = "factory"
    SUBSTATION = "substation"
    BESS = "bess"
    MAIN_BUS = "main_bus"


class TradeStatus(str, PyEnum):
    OPEN = "open"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class EventSeverity(str, PyEnum):
    INFO = "info"
    WARN = "warn"
    CRITICAL = "critical"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120), default="Grid Operator")
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, native_enum=False), default=UserRole.OPERATOR)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    trades_sold: Mapped[list["EnergyTrade"]] = relationship(
        back_populates="seller", foreign_keys="EnergyTrade.seller_id"
    )
    trades_bought: Mapped[list["EnergyTrade"]] = relationship(
        back_populates="buyer", foreign_keys="EnergyTrade.buyer_id"
    )


class GridAsset(Base):
    __tablename__ = "grid_assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    asset_type: Mapped[AssetType] = mapped_column(SAEnum(AssetType, native_enum=False))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    rated_kw: Mapped[float] = mapped_column(Float, default=0.0)
    mqtt_topic: Mapped[str] = mapped_column(String(255), default="")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    is_online: Mapped[bool] = mapped_column(Boolean, default=True)

    telemetry: Mapped[list["TelemetrySample"]] = relationship(back_populates="asset")


class TelemetrySample(Base):
    __tablename__ = "telemetry_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("grid_assets.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    power_kw: Mapped[float] = mapped_column(Float, default=0.0)
    voltage_v: Mapped[float] = mapped_column(Float, default=415.0)
    frequency_hz: Mapped[float] = mapped_column(Float, default=50.0)
    soc_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    temperature_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    extra_json: Mapped[str] = mapped_column(Text, default="{}")

    asset: Mapped["GridAsset"] = relationship(back_populates="telemetry")


class EnergyTrade(Base):
    __tablename__ = "energy_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kwh: Mapped[float] = mapped_column(Float)
    price_per_kwh: Mapped[float] = mapped_column(Float)
    status: Mapped[TradeStatus] = mapped_column(SAEnum(TradeStatus, native_enum=False), default=TradeStatus.OPEN)
    source_asset_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sink_asset_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    seller: Mapped["User"] = relationship(foreign_keys=[seller_id], back_populates="trades_sold")
    buyer: Mapped["User"] = relationship(foreign_keys=[buyer_id], back_populates="trades_bought")


class GridEvent(Base):
    __tablename__ = "grid_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    code: Mapped[str] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[EventSeverity] = mapped_column(SAEnum(EventSeverity, native_enum=False), default=EventSeverity.INFO)
    source: Mapped[str] = mapped_column(String(80), default="engine")


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    horizon_minutes: Mapped[int] = mapped_column(Integer, default=60)
    kind: Mapped[str] = mapped_column(String(40))
    payload_json: Mapped[str] = mapped_column(Text)
