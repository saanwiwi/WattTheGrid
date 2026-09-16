from __future__ import annotations

import asyncio
import json
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Optional

from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self.history: Deque[dict[str, Any]] = deque(maxlen=120)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        self.history.append(payload)
        body = json.dumps(payload, default=str)
        async with self._lock:
            clients = list(self._clients)
        stale: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_text(body)
            except Exception:
                stale.append(ws)
        for ws in stale:
            await self.disconnect(ws)


hub = Hub()
