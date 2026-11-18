import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import alerts, health, metrics, settings as settings_router, system, websocket
from app.config import config
from app.database.database import Database
from app.database.models import AppSettings
from app.services.alerts import evaluate_alerts
from app.services.monitoring import SystemMonitor, prune_metrics

LOCAL_FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def create_app(
    database: Database | None = None,
    monitor: SystemMonitor | None = None,
    monitoring_enabled: bool = True,
) -> FastAPI:
    db_instance = database or Database()
    monitor_instance = monitor or SystemMonitor()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        db_instance.create_all()
        with db_instance.session() as db:
            settings = db.get(AppSettings, 1)
            if settings is None:
                settings = AppSettings(id=1)
                db.add(settings)
                db.commit()
                db.refresh(settings)
            app.state.settings = settings
        task = None
        if monitoring_enabled:
            task = asyncio.create_task(collect_metrics(app))
        try:
            yield
        finally:
            if task is not None:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    app = FastAPI(title="PulseWatch API", version="1.0.0", lifespan=lifespan)
    app.state.database = db_instance
    app.state.monitor = monitor_instance
    app.state.connection_manager = websocket.ConnectionManager()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=LOCAL_FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "PUT", "OPTIONS"],
        allow_headers=["*"],
    )
    app.include_router(health.router, prefix="/api")
    app.include_router(system.router, prefix="/api")
    app.include_router(metrics.router, prefix="/api")
    app.include_router(alerts.router, prefix="/api")
    app.include_router(settings_router.router, prefix="/api")
    app.include_router(websocket.router)
    return app


async def collect_metrics(app: FastAPI) -> None:
    while True:
        metric = await asyncio.to_thread(app.state.monitor.collect)
        with app.state.database.session() as db:
            db.add(metric)
            db.flush()
            settings = db.get(AppSettings, 1)
            if settings is None:
                settings = AppSettings(id=1)
                db.add(settings)
                db.flush()
            evaluate_alerts(db, metric, settings)
            prune_metrics(db, settings.retention_count)
            db.commit()
            app.state.settings = settings
        await app.state.connection_manager.broadcast(
            {
                "type": "metrics",
                "data": {
                    key: value.isoformat() if hasattr(value, "isoformat") else value
                    for key, value in vars(metric).items()
                    if not key.startswith("_") and key != "metadata"
                },
            }
        )
        await asyncio.sleep(app.state.settings.sample_interval_seconds)


app = create_app()
