from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str = "Grid Operator"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str

    model_config = {"from_attributes": True}


class MainBusOut(BaseModel):
    id: str
    load_kw: float
    flow_kw: float
    harmonic_thd: float
    frequency_hz: float
    impedance_ohm: float
    state: str
    field_state: str
    threshold_kw: float
    max_kw: float


class AssetMetricsOut(BaseModel):
    solar_kw: float
    solar_efficiency: float
    ev_fleet_kw: float
    ev_units: int
    battery_soc_pct: float
    battery_chemistry: str
    factory_kw: float
    factory_load_pct: float


class TopologyNodeOut(BaseModel):
    id: str
    label: str
    kind: str
    x: float
    y: float
    z: float
    power_kw: float
    stress: float
    online: bool


class EventOut(BaseModel):
    ts: datetime
    code: str
    message: str
    severity: str


class GridSnapshot(BaseModel):
    sys_id: str
    version: str
    bus: str
    status: str
    lat: float
    lng: float
    utc: datetime
    live: bool
    headline: str
    copy: str
    main_bus: MainBusOut
    assets: AssetMetricsOut
    topology: list[TopologyNodeOut]
    events: list[EventOut]
    advisor: dict[str, Any]


class CrisisRequest(BaseModel):
    scenario: Literal["ev_surge", "cloud_cover", "blackout", "compound"] = "compound"
    intensity: float = Field(default=1.0, ge=0.1, le=3.0)
    autonomous: bool = True


class ForecastPoint(BaseModel):
    minute: int
    solar_kw: float
    load_kw: float


class ForecastOut(BaseModel):
    horizon_minutes: int
    generated_at: datetime
    points: list[ForecastPoint]
    model: str


class OptimizeRequest(BaseModel):
    horizon_minutes: int = 60
    allow_v2g: bool = True
    allow_p2p: bool = True
    max_export_kw: float = 80.0


class ScheduleSlot(BaseModel):
    minute: int
    solar_kw: float
    load_kw: float
    battery_kw: float
    v2g_kw: float
    grid_import_kw: float
    p2p_kw: float
    soc_pct: float


class OptimizeOut(BaseModel):
    objective_cost: float
    unserved_kwh: float
    slots: list[ScheduleSlot]
    notes: list[str]


class TradeCreate(BaseModel):
    buyer_id: int
    kwh: float = Field(gt=0)
    price_per_kwh: float = Field(gt=0)
    source_asset_id: Optional[str] = None
    sink_asset_id: Optional[str] = None


class TradeOut(BaseModel):
    id: int
    seller_id: int
    buyer_id: int
    kwh: float
    price_per_kwh: float
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IoTIngest(BaseModel):
    asset_id: str
    power_kw: float
    voltage_v: float = 415.0
    frequency_hz: float = 50.0
    soc_pct: Optional[float] = None
    temperature_c: Optional[float] = None
    extra: dict[str, Any] = Field(default_factory=dict)
