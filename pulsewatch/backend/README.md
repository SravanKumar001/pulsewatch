# PulseWatch backend

Python 3.12 FastAPI service that samples the local host with `psutil`, persists metrics and alerts in SQLite, and streams new metrics over WebSockets.

## Run locally

```powershell
cd pulsewatch\backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m app
```

The service reads `DATABASE_URL`, `HOST`, and `PORT` from `.env`. The default SQLite file is `pulsewatch.db` in the backend working directory. The API docs are available at `/docs`. For development with autoreload, run `uvicorn app.main:app --reload` instead.

## API

- `GET /api/health`, `GET /api/system`
- `GET /api/metrics/current`, `GET /api/metrics/history`
- `GET /api/alerts?active_only=false`
- `GET /api/settings`, `PUT /api/settings`
- `ws://localhost:8000/ws/metrics` streams a persisted sample about every two seconds.

The settings PUT body requires CPU, memory, and disk thresholds (0–100), cooldown seconds (0–86400), retention count (1–100000), and sample interval seconds (1–60). CORS is limited to the localhost and 127.0.0.1 frontend origins on ports 3000 and 5173.

## Tests

```powershell
pytest
```
