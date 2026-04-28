"""Compute and persist finance analytics signals.

Run from ``backend`` after migrations:

    python -m app.scripts.compute_finance_analytics
"""

from __future__ import annotations

import asyncio

from app.api.routes.finance import get_finance_overview
from app.db import SessionLocal


async def compute_finance_analytics() -> None:
    async with SessionLocal() as session:
        overview = await get_finance_overview(_=None, session=session)
        print("Computed finance analytics:")
        print(f"  company: {overview.companyName or 'none'}")
        print(f"  insight_signals: {len(overview.insightCards)}")
        print(f"  generated_at: {overview.generatedAt}")
        if overview.insightCards:
            first = overview.insightCards[0]
            print(f"  analytics_run_id: {first.runId}")
            print(f"  model_version: {first.modelVersion}")


def main() -> None:
    asyncio.run(compute_finance_analytics())


if __name__ == "__main__":
    main()
