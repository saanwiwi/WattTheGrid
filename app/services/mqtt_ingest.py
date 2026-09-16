from __future__ import annotations

import asyncio
import json
from typing import Optional

from app.config import get_settings
from app.services.grid_engine import engine

try:
    import paho.mqtt.client as mqtt
except ImportError:  # pragma: no cover
    mqtt = None


_client: Optional["mqtt.Client"] = None
_loop: Optional[asyncio.AbstractEventLoop] = None


def _on_connect(client, userdata, flags, reason_code, properties=None):  # noqa: ARG001
    prefix = get_settings().mqtt_topic_prefix
    client.subscribe(f"{prefix}/nodes/+/telemetry")
    client.subscribe(f"{prefix}/meters/+/reading")


def _on_message(client, userdata, msg):  # noqa: ARG001
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError:
        return
    asset_id = payload.get("asset_id") or msg.topic.split("/")[-2]
    power = float(payload.get("power_kw", 0.0))
    soc = payload.get("soc_pct")
    if _loop is not None:
        _loop.call_soon_threadsafe(engine.ingest_iot, asset_id, power, soc)


def start_mqtt(loop: asyncio.AbstractEventLoop) -> None:
    global _client, _loop
    settings = get_settings()
    if not settings.mqtt_enabled or mqtt is None:
        return
    _loop = loop
    _client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="wtg-backend")
    if settings.mqtt_username:
        _client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
    _client.on_connect = _on_connect
    _client.on_message = _on_message
    _client.connect_async(settings.mqtt_host, settings.mqtt_port, 60)
    _client.loop_start()


def stop_mqtt() -> None:
    global _client
    if _client is not None:
        _client.loop_stop()
        _client.disconnect()
        _client = None


def publish_twin(snapshot: dict) -> None:
    settings = get_settings()
    if _client is None or not settings.mqtt_enabled:
        return
    topic = f"{settings.mqtt_topic_prefix}/twin/snapshot"
    body = {
        "sys_id": snapshot["sys_id"],
        "status": snapshot["status"],
        "load_kw": snapshot["main_bus"]["load_kw"],
        "solar_kw": snapshot["assets"]["solar_kw"],
        "battery_soc_pct": snapshot["assets"]["battery_soc_pct"],
    }
    _client.publish(topic, json.dumps(body), qos=0)
