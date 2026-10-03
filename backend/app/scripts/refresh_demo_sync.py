"""Record a fresh successful sync for the demo company.

The demo has no live accounting connection, so its seeded sync runs age and the
dashboard's data-freshness check eventually flags every feed as stale. This logs a
new incremental sync run per object type, as a real connector would.

Run from ``backend``:

    python -m app.scripts.refresh_demo_sync
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import text

from app.db import engine
from app.scripts.seed_finance_demo import COMPANY_CODE


async def refresh_demo_sync() -> int:
    now = datetime.now(UTC)
    async with engine.begin() as conn:
        cursors = (
            await conn.execute(
                text(
                    """
                    SELECT sc.company_id, sc.source_system_id, sc.company_source_connection_id, sc.object_type
                    FROM meta.sync_cursor sc
                    JOIN core.dim_company c ON c.company_id = sc.company_id
                    WHERE c.company_code = :company_code
                    """
                ),
                {"company_code": COMPANY_CODE},
            )
        ).mappings().all()

        for cursor in cursors:
            params = {**cursor, "now": now, "cursor_value": now.isoformat()}
            await conn.execute(
                text(
                    """
                    INSERT INTO meta.sync_run (
                        company_id, source_system_id, company_source_connection_id, object_type, sync_mode,
                        sync_status, cursor_value, started_at, finished_at, rows_read, rows_loaded, rows_rejected, rows_deleted
                    )
                    VALUES (
                        :company_id, :source_system_id, :company_source_connection_id, :object_type, 'incremental',
                        'success', :cursor_value, :now, :now, 0, 0, 0, 0
                    )
                    """
                ),
                params,
            )
            await conn.execute(
                text(
                    """
                    UPDATE meta.sync_cursor
                    SET cursor_value = :cursor_value, last_successful_sync_at = :now
                    WHERE company_source_connection_id = :company_source_connection_id
                      AND object_type = :object_type
                    """
                ),
                params,
            )
    return len(cursors)


def main() -> None:
    count = asyncio.run(refresh_demo_sync())
    print(f"Recorded a fresh sync for {count} demo object types.")


if __name__ == "__main__":
    main()
