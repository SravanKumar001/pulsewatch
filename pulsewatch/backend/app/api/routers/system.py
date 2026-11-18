import platform
import socket

from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/system")
def system_info() -> dict[str, str]:
    return {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "platform_release": platform.release(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
    }
