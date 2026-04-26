"""Create/grant the read-only database role used by the LLM query tool.

Run with a DATABASE_URL user that can create roles and grant privileges:

    python -m app.scripts.setup_llm_readonly_role --password change-me-readonly
"""

from __future__ import annotations

import argparse
import asyncio
import re

from sqlalchemy import text

from app.db import engine


DEFAULT_ROLE = "solon_llm_readonly"
ROLE_NAME_RE = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


def quote_pg_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def quote_pg_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def quote_ident(value: str) -> str:
    if not ROLE_NAME_RE.fullmatch(value):
        raise ValueError(
            "Role name must be a lowercase PostgreSQL identifier with only letters, numbers, and underscores."
        )
    return quote_pg_ident(value)


async def setup_role(role_name: str, password: str) -> None:
    role_ident = quote_ident(role_name)
    password_literal = quote_pg_literal(password)
    async with engine.begin() as conn:
        database_name = await conn.scalar(text("SELECT current_database()"))
        database_ident = quote_pg_ident(str(database_name))
        role_exists = await conn.scalar(
            text("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :role_name)"),
            {"role_name": role_name},
        )
        if role_exists:
            await conn.execute(text(f"ALTER ROLE {role_ident} WITH LOGIN PASSWORD {password_literal}"))
        else:
            await conn.execute(text(f"CREATE ROLE {role_ident} WITH LOGIN PASSWORD {password_literal}"))

        await conn.execute(text(f"ALTER ROLE {role_ident} SET statement_timeout = '5s'"))
        await conn.execute(text(f"ALTER ROLE {role_ident} SET idle_in_transaction_session_timeout = '10s'"))
        await conn.execute(text(f"ALTER ROLE {role_ident} SET default_transaction_read_only = on"))

        await conn.execute(text(f"GRANT CONNECT ON DATABASE {database_ident} TO {role_ident}"))
        await conn.execute(text(f"GRANT USAGE ON SCHEMA mart, core, meta TO {role_ident}"))

        await conn.execute(text(f"GRANT SELECT ON ALL TABLES IN SCHEMA mart TO {role_ident}"))
        await conn.execute(
            text(
                f"""
                GRANT SELECT ON
                    core.dim_company,
                    core.dim_date,
                    core.dim_currency,
                    core.dim_document_type,
                    core.dim_counterparty,
                    core.dim_ledger_account,
                    core.dim_org_unit,
                    core.dim_journal,
                    core.dim_tax_code,
                    core.fact_journal_entry,
                    core.fact_journal_entry_line,
                    core.fact_sales_invoice,
                    core.fact_purchase_invoice,
                    core.fact_open_item_snapshot,
                    core.fact_budget
                TO {role_ident}
                """
            )
        )
        await conn.execute(
            text(
                f"""
                GRANT SELECT ON
                    meta.source_system,
                    meta.company_source_connection,
                    meta.sync_run,
                    meta.sync_cursor
                TO {role_ident}
                """
            )
        )

        await conn.execute(text(f"ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO {role_ident}"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create the read-only database role used by LLM finance queries.")
    parser.add_argument("--role", default=DEFAULT_ROLE, help=f"Role name to create/update. Defaults to {DEFAULT_ROLE}.")
    parser.add_argument("--password", required=True, help="Password for the read-only role.")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    await setup_role(role_name=args.role, password=args.password)
    print(f"Configured read-only LLM database role: {args.role}")


if __name__ == "__main__":
    asyncio.run(main())
