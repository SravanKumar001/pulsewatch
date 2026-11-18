from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.database.models import Alert
from app.schemas.schemas import AlertRead

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertRead])
def list_alerts(
    limit: int = Query(default=100, ge=1, le=1000),
    active_only: bool = False,
    db: Session = Depends(get_db),
) -> list[Alert]:
    statement = select(Alert).order_by(Alert.triggered_at.desc()).limit(limit)
    if active_only:
        statement = statement.where(Alert.active.is_(True))
    return list(db.scalars(statement))
