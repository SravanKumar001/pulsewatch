from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import Alert, AppSettings, Metric


_THRESHOLDS = {
    "cpu": ("cpu_percent", "cpu_threshold"),
    "memory": ("memory_percent", "memory_threshold"),
    "disk": ("disk_percent", "disk_threshold"),
}


def evaluate_alerts(db: Session, metric: Metric, settings: AppSettings) -> list[Alert]:
    now = datetime.now(timezone.utc)
    transitions: list[Alert] = []
    for metric_type, (value_field, threshold_field) in _THRESHOLDS.items():
        value = getattr(metric, value_field)
        if value is None:
            continue
        threshold = getattr(settings, threshold_field)
        active = db.scalar(
            select(Alert)
            .where(Alert.metric_type == metric_type, Alert.active.is_(True))
            .order_by(Alert.triggered_at.desc())
        )
        if value >= threshold:
            if active is not None:
                active.value = value
                continue
            last_triggered = db.scalar(
                select(Alert.triggered_at)
                .where(Alert.metric_type == metric_type)
                .order_by(Alert.triggered_at.desc())
                .limit(1)
            )
            if last_triggered is not None:
                if last_triggered.tzinfo is None:
                    last_triggered = last_triggered.replace(tzinfo=timezone.utc)
                if now - last_triggered < timedelta(seconds=settings.cooldown_seconds):
                    continue
            alert = Alert(
                metric_type=metric_type,
                value=value,
                threshold=threshold,
                message=f"{metric_type.capitalize()} usage is {value:.1f}% (threshold {threshold:.1f}%).",
                triggered_at=now,
                active=True,
            )
            db.add(alert)
            transitions.append(alert)
        elif active is not None:
            active.active = False
            active.resolved_at = now
            active.value = value
            transitions.append(active)
    return transitions
