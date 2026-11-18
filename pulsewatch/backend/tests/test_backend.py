import time
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.database.database import Database
from app.database.models import Alert, AppSettings, Metric
from app.main import create_app
from app.services.alerts import evaluate_alerts
from app.services.monitoring import SystemMonitor, prune_metrics


def make_metric(**values: object) -> Metric:
    data: dict[str, object] = {
        "timestamp": datetime.now(timezone.utc),
        "cpu_percent": 20.0,
        "memory_percent": 30.0,
        "memory_used_bytes": 300,
        "memory_total_bytes": 1000,
        "disk_percent": 40.0,
        "disk_used_bytes": 400,
        "disk_total_bytes": 1000,
        "network_bytes_sent": 100,
        "network_bytes_recv": 200,
        "network_sent_rate": 10.0,
        "network_recv_rate": 20.0,
        "uptime_seconds": 500.0,
        "hostname": "test-host",
        "platform": "TestOS",
        "platform_release": "1.0",
        "architecture": "x86_64",
        "cpu_count": 4,
    }
    data.update(values)
    return Metric(**data)


def make_test_app():
    database = Database("sqlite:///:memory:")
    return create_app(database=database, monitoring_enabled=False), database


def test_health_endpoint_reports_database() -> None:
    app, _ = make_test_app()
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_monitor_uses_live_psutil_values_and_returns_network_counters() -> None:
    monitor = SystemMonitor()
    memory = SimpleNamespace(percent=45.0, used=450, total=1000)
    disk = SimpleNamespace(percent=55.0, used=550, total=1000)
    network = SimpleNamespace(bytes_sent=1234, bytes_recv=5678)
    with (
        patch("app.services.monitoring.psutil.cpu_percent", return_value=12.5),
        patch("app.services.monitoring.psutil.virtual_memory", return_value=memory),
        patch("app.services.monitoring.psutil.disk_usage", return_value=disk),
        patch("app.services.monitoring.psutil.net_io_counters", return_value=network),
        patch("app.services.monitoring.psutil.boot_time", return_value=1000),
        patch("app.services.monitoring.psutil.cpu_count", return_value=8),
        patch("app.services.monitoring.time.time", return_value=2000),
    ):
        metric = monitor.collect()
    assert metric.cpu_percent == 12.5
    assert metric.memory_percent == 45.0
    assert metric.disk_percent == 55.0
    assert metric.network_bytes_sent == 1234
    assert metric.network_bytes_recv == 5678
    assert metric.uptime_seconds == 1000
    assert metric.cpu_count == 8


def test_monitor_marks_failed_psutil_reads_unavailable() -> None:
    with (
        patch("app.services.monitoring.psutil.cpu_percent", side_effect=OSError),
        patch("app.services.monitoring.psutil.virtual_memory", side_effect=OSError),
        patch("app.services.monitoring.psutil.disk_usage", side_effect=OSError),
        patch("app.services.monitoring.psutil.net_io_counters", side_effect=OSError),
        patch("app.services.monitoring.psutil.boot_time", side_effect=OSError),
        patch("app.services.monitoring.psutil.cpu_count", side_effect=OSError),
    ):
        metric = SystemMonitor().collect()
    assert metric.cpu_percent is None
    assert metric.memory_percent is None
    assert metric.disk_percent is None
    assert metric.network_bytes_sent is None
    assert metric.uptime_seconds is None
    assert metric.cpu_count is None


def test_alerts_create_resolve_and_obey_cooldown() -> None:
    database = Database("sqlite:///:memory:")
    database.create_all()
    with database.session() as db:
        settings = AppSettings(id=1, cpu_threshold=80, memory_threshold=90, disk_threshold=90,
                               cooldown_seconds=3600, retention_count=100, sample_interval_seconds=2)
        db.add(settings)
        db.flush()

        assert len(evaluate_alerts(db, make_metric(cpu_percent=85), settings)) == 1
        db.flush()
        assert len(evaluate_alerts(db, make_metric(cpu_percent=92), settings)) == 0
        db.flush()
        assert len(evaluate_alerts(db, make_metric(cpu_percent=50), settings)) == 1
        db.flush()
        assert len(evaluate_alerts(db, make_metric(cpu_percent=85), settings)) == 0
        db.commit()
        alerts = list(db.query(Alert).order_by(Alert.id))

    assert len(alerts) == 1
    assert alerts[0].active is False
    assert alerts[0].resolved_at is not None


def test_settings_validation_and_update() -> None:
    app, _ = make_test_app()
    with TestClient(app) as client:
        invalid = client.put(
            "/api/settings",
            json={
                "cpu_threshold": 101,
                "memory_threshold": 90,
                "disk_threshold": 90,
                "cooldown_seconds": 10,
                "retention_count": 100,
                "sample_interval_seconds": 2,
            },
        )
        assert invalid.status_code == 422

        valid = client.put(
            "/api/settings",
            json={
                "cpu_threshold": 75,
                "memory_threshold": 80,
                "disk_threshold": 85,
                "cooldown_seconds": 10,
                "retention_count": 200,
                "sample_interval_seconds": 3,
            },
        )
        assert valid.status_code == 200
        assert valid.json()["cpu_threshold"] == 75
        assert client.get("/api/settings").json()["retention_count"] == 200


def test_history_endpoint_returns_persisted_metrics() -> None:
    app, database = make_test_app()
    with TestClient(app) as client:
        with database.session() as db:
            db.add(make_metric(cpu_percent=33.5))
            db.commit()

        response = client.get("/api/metrics/history")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["cpu_percent"] == 33.5
    assert response.json()[0]["hostname"] == "test-host"


def test_metric_retention_prunes_oldest_rows() -> None:
    database = Database("sqlite:///:memory:")
    database.create_all()
    with database.session() as db:
        db.add_all([make_metric(cpu_percent=value) for value in (10, 20, 30)])
        db.flush()
        prune_metrics(db, retention_count=2)
        db.commit()
        rows = list(db.query(Metric).order_by(Metric.id))
    assert [row.cpu_percent for row in rows] == [20, 30]


def test_websocket_broadcasts_collected_metrics() -> None:
    class MockMonitor:
        def collect(self) -> Metric:
            time.sleep(0.1)
            return make_metric(cpu_percent=61.0)

    app = create_app(
        database=Database("sqlite:///:memory:"),
        monitor=MockMonitor(),  # type: ignore[arg-type]
    )
    with TestClient(app) as client:
        with client.websocket_connect("/ws/metrics") as socket:
            payload = socket.receive_json()
    assert payload["type"] == "metrics"
    assert payload["data"]["cpu_percent"] == 61.0
