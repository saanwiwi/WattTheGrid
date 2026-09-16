"""Publish synthetic meter telemetry into the WattTheGrid MQTT bus."""

from __future__ import annotations

import json
import random
import time

import paho.mqtt.client as mqtt

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect("localhost", 1883, 60)

assets = {
    "PV-EAST": 182.0,
    "EV-HUB": 102.0,
    "FAC-01": 200.0,
    "BESS-1": -18.0,
}

while True:
    for asset_id, base in assets.items():
        payload = {
            "asset_id": asset_id,
            "power_kw": round(base + random.uniform(-8, 8), 2),
            "voltage_v": 415,
            "frequency_hz": round(50 + random.uniform(-0.04, 0.04), 3),
            "soc_pct": 98.0 if asset_id == "BESS-1" else None,
        }
        topic = f"wtg/nodes/{asset_id}/telemetry"
        client.publish(topic, json.dumps(payload))
        print(topic, payload)
    time.sleep(2)
