import os
import platform
import socket
import time
from datetime import datetime, timezone
from typing import Any

import psutil

from app.database.models import Metric


class SystemMonitor:
    def __init__(self) -> None:
        self._previous_network: tuple[int, int, float] | None = None

    @staticmethod
    def _read(read_fn: Any) -> Any:
        try:
            return read_fn()
        except (psutil.Error, OSError):
            return None

    def collect(self) -> Metric:
        now = time.monotonic()
        cpu = self._read(lambda: psutil.cpu_percent(interval=0.1))
        memory = self._read(psutil.virtual_memory)
        disk_root = (
            os.getenv("SystemDrive", "C:") + "\\"
            if platform.system() == "Windows"
            else "/"
        )
        disk = self._read(lambda: psutil.disk_usage(disk_root))
        network = self._read(psutil.net_io_counters)
        uptime = self._read(lambda: time.time() - psutil.boot_time())
        cpu_count = self._read(psutil.cpu_count)

        sent = recv = sent_rate = recv_rate = None
        if network is not None:
            sent, recv = int(network.bytes_sent), int(network.bytes_recv)
            if self._previous_network is not None:
                previous_sent, previous_recv, previous_time = self._previous_network
                elapsed = now - previous_time
                if elapsed > 0 and sent >= previous_sent and recv >= previous_recv:
                    sent_rate = (sent - previous_sent) / elapsed
                    recv_rate = (recv - previous_recv) / elapsed
            self._previous_network = (sent, recv, now)

        return Metric(
            timestamp=datetime.now(timezone.utc),
            cpu_percent=cpu,
            memory_percent=getattr(memory, "percent", None),
            memory_used_bytes=getattr(memory, "used", None),
            memory_total_bytes=getattr(memory, "total", None),
            disk_percent=getattr(disk, "percent", None),
            disk_used_bytes=getattr(disk, "used", None),
            disk_total_bytes=getattr(disk, "total", None),
            network_bytes_sent=sent,
            network_bytes_recv=recv,
            network_sent_rate=sent_rate,
            network_recv_rate=recv_rate,
            uptime_seconds=uptime,
            hostname=self._read(socket.gethostname) or "unavailable",
            platform=platform.system() or "unavailable",
            platform_release=platform.release() or "unavailable",
            architecture=platform.machine() or "unavailable",
            cpu_count=cpu_count,
        )


def prune_metrics(db: Any, retention_count: int) -> None:
    from sqlalchemy import delete, select

    from app.database.models import Metric

    cutoff_id = db.scalar(
        select(Metric.id).order_by(Metric.id.desc()).offset(retention_count).limit(1)
    )
    if cutoff_id is not None:
        db.execute(delete(Metric).where(Metric.id <= cutoff_id))
