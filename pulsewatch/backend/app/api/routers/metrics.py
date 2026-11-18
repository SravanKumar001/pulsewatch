from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.database.models import Metric
from app.schemas.schemas import MetricRead

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/current", response_model=MetricRead)
def current_metric(db: Session = Depends(get_db)) -> Metric:
    metric = db.scalar(select(Metric).order_by(Metric.timestamp.desc()).limit(1))
    if metric is None:
        raise HTTPException(status_code=503, detail="No metrics have been collected yet.")
    return metric


@router.get("/history", response_model=list[MetricRead])
def metric_history(
    request: Request,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[Metric]:
    retention = request.app.state.settings.retention_count
    return list(
        db.scalars(
            select(Metric)
            .order_by(Metric.timestamp.desc())
            .limit(min(limit, retention))
        )
    )
