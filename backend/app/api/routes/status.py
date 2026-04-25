from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def get_status() -> dict[str, str]:
    return {"service": "solon-backend", "status": "ready"}
