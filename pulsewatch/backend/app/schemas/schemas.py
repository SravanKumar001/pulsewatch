from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MetricRead(BaseModel):
    id: int
    timestamp: datetime
    cpu_percent: float | None
    memory_percent: float | None
    memory_used_bytes: int | None
    memory_total_bytes: int | None
    disk_percent: float | None
    disk_used_bytes: int | None
    disk_total_bytes: int | None
    network_bytes_sent: int | None
    network_bytes_recv: int | None
    network_sent_rate: float | None
    network_recv_rate: float | None
    uptime_seconds: float | None
    hostname: str
    platform: str
    platform_release: str
    architecture: str
    cpu_count: int | None

    model_config = ConfigDict(from_attributes=True)


class AlertRead(BaseModel):
    id: int
    metric_type: str
    severity: str
    value: float
    threshold: float
    message: str
    triggered_at: datetime
    resolved_at: datetime | None
    active: bool

    model_config = ConfigDict(from_attributes=True)


class SettingsRead(BaseModel):
    cpu_threshold: float
    memory_threshold: float
    disk_threshold: float
    cooldown_seconds: int
    retention_count: int
    sample_interval_seconds: int

    model_config = ConfigDict(from_attributes=True)


class SettingsUpdate(BaseModel):
    cpu_threshold: float = Field(ge=0, le=100)
    memory_threshold: float = Field(ge=0, le=100)
    disk_threshold: float = Field(ge=0, le=100)
    cooldown_seconds: int = Field(ge=0, le=86400)
    retention_count: int = Field(ge=1, le=100000)
    sample_interval_seconds: int = Field(ge=1, le=60)


class HealthRead(BaseModel):
    status: str
    database: str
