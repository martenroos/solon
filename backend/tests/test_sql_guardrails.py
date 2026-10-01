"""Guardrails around LLM-written SQL.

The read-only Postgres role is the real security boundary; these checks make sure
the application layer rejects unsafe queries early, with an error the model can act on.
"""

import asyncio
from types import SimpleNamespace

import pytest

from app.llm import tools
from app.llm.tools import ToolExecutionContext, _validate_read_only_sql, query_finance_db_tool


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT 1",
        "select account_name from mart.v_trial_balance_by_period",
        "  \n SELECT counterparty_name FROM mart.v_ar_aging_latest",
        "WITH totals AS (SELECT 1 AS x) SELECT x FROM totals",
        # Words that merely contain a forbidden keyword are fine.
        "SELECT created_at, last_updated, dataset FROM core.fact_journal_entry",
        "SELECT * FROM mart.v_pl_by_period LIMIT 10 OFFSET 5",
    ],
)
def test_accepts_read_only_queries(sql: str) -> None:
    assert _validate_read_only_sql(sql) == sql.strip()


def test_strips_single_trailing_semicolon() -> None:
    assert _validate_read_only_sql("SELECT 1;") == "SELECT 1"


@pytest.mark.parametrize(
    ("sql", "reason"),
    [
        ("", "required"),
        ("   ", "required"),
        ("SELECT 1; DROP TABLE core.dim_company", "single SELECT"),
        ("SELECT 1; SELECT 2;", "single SELECT"),
        ("DELETE FROM core.fact_budget", "Only SELECT or WITH"),
        ("EXPLAIN ANALYZE SELECT 1", "Only SELECT or WITH"),
        ("UPDATE core.dim_company SET company_name = 'x'", "Only SELECT or WITH"),
        # Postgres allows data-modifying statements inside CTEs.
        ("WITH gone AS (DELETE FROM core.fact_budget RETURNING *) SELECT * FROM gone", "forbidden SQL keyword"),
        ("SELECT * INTO mart.stolen FROM core.dim_company", "forbidden SQL keyword"),
    ],
)
def test_rejects_unsafe_queries(sql: str, reason: str) -> None:
    with pytest.raises(ValueError, match=reason):
        _validate_read_only_sql(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM users",
        "SELECT message FROM chat_messages",
        "SELECT * FROM public.chat_conversations",
        "SELECT table_name FROM information_schema.tables",
        "SELECT rolname FROM pg_catalog.pg_roles",
        "SELECT version_num FROM alembic_version",
    ],
)
def test_rejects_app_and_system_tables(sql: str) -> None:
    with pytest.raises(ValueError, match="not available"):
        _validate_read_only_sql(sql)


def _context() -> ToolExecutionContext:
    return ToolExecutionContext(user=SimpleNamespace(id=1), metadata={})


def test_tool_rejects_unsafe_sql_before_touching_the_database(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail_if_called(*_args, **_kwargs):
        raise AssertionError("run_finance_query must not be called for unsafe SQL")

    monkeypatch.setattr(tools, "run_finance_query", fail_if_called)

    with pytest.raises(ValueError, match="Only SELECT or WITH"):
        asyncio.run(query_finance_db_tool({"sql": "DROP TABLE core.dim_company"}, _context()))


def test_tool_rejects_non_integer_max_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tools, "run_finance_query", None)

    with pytest.raises(ValueError, match="max_rows must be an integer"):
        asyncio.run(query_finance_db_tool({"sql": "SELECT 1", "max_rows": "lots"}, _context()))


class _FakeResult:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def mappings(self) -> "_FakeResult":
        return self

    def all(self) -> list[dict]:
        return self._rows


class _FakeSession:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.statements: list[tuple[str, dict | None]] = []
        self.rolled_back = False

    async def __aenter__(self) -> "_FakeSession":
        return self

    async def __aexit__(self, *_exc) -> None:
        return None

    async def execute(self, statement, params=None) -> _FakeResult:
        self.statements.append((str(statement), params))
        return _FakeResult(self.rows)

    async def rollback(self) -> None:
        self.rolled_back = True


def test_query_runs_read_only_with_timeout_row_cap_and_rollback(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeSession(rows=[{"account": "Acme BV", "overdue_amount": 1200}])
    monkeypatch.setattr(tools, "LLMSessionLocal", lambda: session)

    result = asyncio.run(tools.run_finance_query("SELECT 1;", max_rows=10_000))

    executed = [sql for sql, _ in session.statements]
    assert executed[0] == "SET TRANSACTION READ ONLY"
    assert executed[1] == "SET LOCAL statement_timeout = '5s'"
    assert executed[2] == "SELECT * FROM (SELECT 1) AS llm_finance_query LIMIT :max_rows"
    assert session.statements[2][1] == {"max_rows": 200}  # requested 10k, capped at 200
    assert session.rolled_back
    assert result["columns"] == ["account", "overdue_amount"]
    assert result["row_count"] == 1
    assert result["truncated"] is False
