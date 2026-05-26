from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class FinanceRepository:
    """Read-only access to finance warehouse and mart data."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def one(self, sql: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        row = (await self._session.execute(text(sql), params or {})).mappings().first()
        return dict(row) if row else {}

    async def many(self, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return [dict(row) for row in (await self._session.execute(text(sql), params or {})).mappings().all()]
