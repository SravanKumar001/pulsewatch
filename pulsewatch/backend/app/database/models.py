from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Metric(Base):
    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_used_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_total_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disk_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_used_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disk_total_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    network_bytes_sent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    network_bytes_recv: Mapped[int | None] = mapped_column(Integer, nullable=True)
    network_sent_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    network_recv_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    uptime_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    hostname: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(255))
    platform_release: Mapped[str] = mapped_column(String(255))
    architecture: Mapped[str] = mapped_column(String(255))
    cpu_count: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    metric_type: Mapped[str] = mapped_column(String(32), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="warning")
    value: Mapped[float] = mapped_column(Float)
    threshold: Mapped[float] = mapped_column(Float)
    message: Mapped[str] = mapped_column(String(255))
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    cpu_threshold: Mapped[float] = mapped_column(Float, default=90.0)
    memory_threshold: Mapped[float] = mapped_column(Float, default=90.0)
    disk_threshold: Mapped[float] = mapped_column(Float, default=90.0)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, default=300)
    retention_count: Mapped[int] = mapped_column(Integer, default=10000)
    sample_interval_seconds: Mapped[int] = mapped_column(Integer, default=2)
