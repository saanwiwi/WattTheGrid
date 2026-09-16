from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "WattTheGrid"
    app_env: str = "development"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 720
    algorithm: str = "HS256"

    database_url: str = "sqlite+aiosqlite:///./data/watt_the_grid.db"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    mqtt_enabled: bool = False
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_topic_prefix: str = "wtg"

    tick_interval_seconds: float = 1.0
    persist_telemetry_every_n_ticks: int = 5

    demo_admin_email: str = "operator@wattthegrid.local"
    demo_admin_password: str = "autonomous-v4"

    sys_id: str = "WTG-09"
    bus_id: str = "TX-400"
    load_bus_id: str = "TX-488"
    latitude: float = 34.0522
    longitude: float = -118.2437

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
