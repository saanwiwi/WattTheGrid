# WattTheGrid backend

Python FastAPI control plane for the **WHAT THE GRID** digital twin: live bus telemetry, crisis simulation, XGBoost/sklearn forecasting, OR-Tools dispatch, MQTT ingest, and a PostgreSQL (or SQLite) ledger.

The live snapshot is shaped to the dashboard in the screenshot: `TX-400` / `TX-488` main bus, `WTG-09`, 120 kW nominal load, solar / EV / LFP / factory tiles, isometric topology nodes, and the system event stream.

## Quick start (SQLite, no Docker)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000/docs

Demo operator:

- email: `operator@wattthegrid.local`
- password: `autonomous-v4`

## Docker (Postgres + Mosquitto + API)

```bash
docker compose up --build
```

## Frontend contract

| UI control | Backend |
| --- | --- |
| Live bus / tiles / topology / log | `GET /api/v1/grid/snapshot` and `WS /api/v1/ws/grid` |
| **SIMULATE CRISIS** | `POST /api/v1/crisis/simulate` `{"scenario":"compound","intensity":1,"autonomous":true}` |
| **RESET BASELINE** | `POST /api/v1/crisis/reset` |
| AI advisor panel | `snapshot.advisor` on every tick |
| Forecast | `GET /api/v1/forecast?horizon_minutes=60` |
| V2G / P2P schedule | `POST /api/v1/optimize` |
| P2P ledger | `GET/POST /api/v1/trades` |
| IoT push (if not MQTT) | `POST /api/v1/iot/ingest` |

Crisis `scenario` values: `ev_surge`, `cloud_cover`, `blackout`, `compound`.

WebSocket: connect to `ws://localhost:8000/api/v1/ws/grid`. The server streams a full snapshot every tick (default 1s). The client does not need to send messages.

### Snapshot shape (matches the UI)

```json
{
  "sys_id": "WTG-09",
  "version": "AUTONOMOUS V4",
  "bus": "TX-400 MAIN BUS",
  "status": "NOMINAL",
  "lat": 34.0522,
  "lng": -118.2437,
  "main_bus": {
    "id": "TX-488",
    "load_kw": 120,
    "frequency_hz": 49.98,
    "impedance_ohm": 0.042,
    "harmonic_thd": 1.8,
    "state": "NOMINAL_FLOW",
    "field_state": "NOMINAL",
    "threshold_kw": 425,
    "max_kw": 500
  },
  "assets": {
    "solar_kw": 182,
    "solar_efficiency": 96.4,
    "ev_fleet_kw": 102,
    "ev_units": 4,
    "battery_soc_pct": 98,
    "factory_kw": 200,
    "factory_load_pct": 68
  }
}
```

## MQTT

Topics (prefix `wtg`):

- `wtg/nodes/{asset_id}/telemetry`
- `wtg/meters/{asset_id}/reading`
- `wtg/twin/snapshot` (outbound from the twin)

Payload:

```json
{"asset_id":"PV-EAST","power_kw":182.4,"voltage_v":415,"frequency_hz":49.99,"soc_pct":null}
```

Asset ids: `SUB-01`, `PV-EAST`, `EV-HUB`, `FAC-01`, `BESS-1`.

Enable with `MQTT_ENABLED=true` then:

```bash
python scripts/publish_mqtt_demo.py
```

## Layout

```
app/main.py                 FastAPI app, twin tick loop, CORS
app/config.py               env settings
app/database.py             SQLAlchemy async engine
app/models.py               users, assets, telemetry, trades, events
app/security.py             JWT + bcrypt
app/api/grid.py             snapshot, crisis, IoT, websocket
app/api/intelligence.py     forecast, OR-Tools, P2P trades
app/api/auth.py             register / token / me
app/services/grid_engine.py digital twin physics matching the UI
app/services/forecast.py    XGBoost solar + sklearn load
app/services/optimizer.py   OR-Tools GLOP dispatch (BESS, V2G, P2P)
app/services/mqtt_ingest.py paho subscriber
```

Tables are created on startup (`create_all`). Point `DATABASE_URL` at Postgres in production:

`postgresql+asyncpg://wtg:wtg@localhost:5432/watt_the_grid`
