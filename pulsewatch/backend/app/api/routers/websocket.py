import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, payload: dict[str, object]) -> None:
        for connection in tuple(self.connections):
            try:
                await connection.send_json(payload)
            except (RuntimeError, WebSocketDisconnect):
                self.disconnect(connection)
            except Exception:
                self.disconnect(connection)


@router.websocket("/ws/metrics")
async def metrics_socket(websocket: WebSocket) -> None:
    manager: ConnectionManager = websocket.app.state.connection_manager
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
