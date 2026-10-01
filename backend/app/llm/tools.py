from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
import re
from typing import Any
from uuid import UUID

from sqlalchemy import text

from app.db import LLMSessionLocal
from app.models.user import User
from app.schemas.chat import ChatArtifact, ChatChart, ChatTask, ChatToolInfo

ToolHandler = Callable[[dict[str, Any], "ToolExecutionContext"], Awaitable[Any]]


@dataclass(slots=True)
class ToolEmittedMessage:
    message_type: str
    message: str
    artifact: ChatArtifact | None = None


@dataclass(slots=True)
class ToolExecutionContext:
    user: User
    metadata: dict[str, Any]
    emitted_messages: list[ToolEmittedMessage] = field(default_factory=list)
    latest_finance_query_sql: str | None = None

    def emit_artifact(self, artifact: ChatArtifact) -> None:
        self.emitted_messages.append(
            ToolEmittedMessage(
                message_type=artifact.type,
                message=artifact.model_dump_json(),
                artifact=artifact,
            )
        )

    def consume_emitted_messages(self) -> list[ToolEmittedMessage]:
        emitted = list(self.emitted_messages)
        self.emitted_messages.clear()
        return emitted


@dataclass(slots=True)
class ChatTool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: ToolHandler

    async def execute(self, arguments: dict[str, Any], context: ToolExecutionContext) -> Any:
        return await self.handler(arguments, context)

    def to_info(self) -> ChatToolInfo:
        return ChatToolInfo(
            name=self.name,
            description=self.description,
            input_schema=self.input_schema,
        )


class ToolRegistry:
    def __init__(self, tools: list[ChatTool] | None = None) -> None:
        self._tools: dict[str, ChatTool] = {}
        for tool in tools or []:
            self.register(tool)

    def register(self, tool: ChatTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> ChatTool | None:
        return self._tools.get(name)

    def list_tools(self, names: list[str] | None = None) -> list[ChatTool]:
        if not names:
            return list(self._tools.values())
        return [tool for name in names if (tool := self._tools.get(name)) is not None]

    def list_tool_info(self) -> list[ChatToolInfo]:
        return [tool.to_info() for tool in self._tools.values()]


FINANCE_WAREHOUSE_QUERY_GUIDE = """
Finance warehouse query guide:
- Use the query_finance_db tool for questions that require actual company financial data.
- Write PostgreSQL SELECT queries only. Prefer fully-qualified schema names.
- Allowed analytical schemas are mart, selected core tables, and selected meta tables.
- Use mart views first when they answer the question:
  - mart.v_trial_balance_by_period: period totals by account. Columns include company_id, fiscal_year_number, fiscal_period_number, account_code, account_name, account_type, account_class, reporting_group_lvl1, reporting_group_lvl2, debit_amount_base, credit_amount_base, net_amount_base.
  - mart.v_pl_by_period: P&L by period, account, and org unit. Columns include company_id, fiscal_year_number, fiscal_period_number, reporting_group_lvl1, reporting_group_lvl2, account_code, account_name, org_unit_name, amount_base.
  - mart.v_budget_vs_actual: budget and actual by period/account/org unit. Columns include company_id, scenario_name, fiscal_year_number, fiscal_period_number, account_code, account_name, account_class, reporting_group_lvl1, reporting_group_lvl2, org_unit_name, budget_amount_base, actual_amount_base, variance_amount_base, actual_vs_budget_pct.
  - mart.v_ar_aging_latest and mart.v_ap_aging_latest: latest open receivable/payable aging by counterparty. Columns include company_id, snapshot_at, counterparty_id, counterparty_name, open_items, total_open_amount_base, avg_days_overdue, current_amount, overdue_1_30, overdue_31_60, overdue_61_90, overdue_90_plus.
  - mart.v_data_freshness: last successful sync and raw pull by company/source/object type.
- Core dimensions:
  - core.dim_company(company_id, company_code, company_name, country_code, base_currency_code)
  - core.dim_ledger_account(ledger_account_id, company_id, account_code, account_name, account_type, account_class, normal_balance_side, reporting_group_lvl1, reporting_group_lvl2, is_bank_account)
  - core.dim_counterparty(counterparty_id, company_id, counterparty_code, counterparty_name, is_customer, is_supplier, country_code, city, payment_terms_days, credit_limit_amount)
  - core.dim_org_unit(org_unit_id, company_id, org_unit_code, org_unit_name, org_unit_type, manager_name)
  - core.dim_journal(journal_id, company_id, journal_code, journal_name, journal_type)
  - core.dim_date(date_key, year_number, quarter_number, month_number, month_name, fiscal_year_number, fiscal_period_number)
- Core facts:
  - core.fact_journal_entry(journal_entry_id, company_id, journal_id, document_type_id, entry_number, document_number, posting_date, due_date, fiscal_year_number, fiscal_period_number, status)
  - core.fact_journal_entry_line(journal_entry_line_id, journal_entry_id, company_id, ledger_account_id, counterparty_id, org_unit_id, posting_date, fiscal_year_number, fiscal_period_number, debit_amount_base, credit_amount_base, signed_amount_base, description)
  - core.fact_sales_invoice(company_id, customer_id, invoice_number, invoice_date, due_date, amount_excl_tax_base, tax_amount_base, amount_incl_tax_base, status)
  - core.fact_purchase_invoice(company_id, supplier_id, invoice_number, invoice_date, due_date, amount_excl_tax_base, tax_amount_base, amount_incl_tax_base, status)
  - core.fact_open_item_snapshot(company_id, snapshot_at, item_type, counterparty_id, document_number, invoice_date, due_date, open_amount_base, days_overdue, aging_bucket, is_overdue)
  - core.fact_budget(company_id, scenario_name, ledger_account_id, org_unit_id, date_key, fiscal_year_number, fiscal_period_number, amount_base)
- For demo data, filter with core.dim_company.company_code = 'SOLON-DEMO' unless the user asks otherwise.
- P&L signs follow ledger signed amounts: revenue is usually negative and expenses positive. When presenting revenue or profit, explain the sign convention or invert signs in SQL with clear aliases.
- Avoid joining customer_id or supplier_id to unrelated integer columns. In this warehouse, customer_id, supplier_id, counterparty_id, ledger_account_id, company_id, and org_unit_id are UUIDs. Join them only to their matching UUID key columns.
- For top overdue receivables, use mart.v_ar_aging_latest directly. Example:
  SELECT counterparty_name AS account, ROUND((overdue_1_30 + overdue_31_60 + overdue_61_90 + overdue_90_plus)::numeric, 2) AS overdue_amount
  FROM mart.v_ar_aging_latest
  WHERE company_id = (SELECT company_id FROM core.dim_company WHERE company_code = 'SOLON-DEMO')
  ORDER BY overdue_amount DESC
  LIMIT 5
- For top overdue payables, use mart.v_ap_aging_latest directly with the same overdue_amount expression.
- For cash-risk charts, prefer labels like account or risk and numeric aliases like overdue_amount, total_open_amount, inflow, or outflow.
- Always aggregate before returning large detail sets. Keep query result sets small and focused.
""".strip()


READ_ONLY_SQL_START_RE = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)
FORBIDDEN_SQL_RE = re.compile(
    r"\b(insert|into|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute|merge|vacuum|refresh|reindex|set|reset)\b",
    re.IGNORECASE,
)
FORBIDDEN_SQL_TARGET_RE = re.compile(
    r"\b(public|information_schema|pg_catalog)\.|"
    r"\b(users|chat_conversations|chat_messages|alembic_version)\b",
    re.IGNORECASE,
)


def _validate_read_only_sql(sql: str) -> str:
    cleaned = sql.strip()
    if not cleaned:
        raise ValueError("SQL query is required.")
    if "\x00" in cleaned:
        raise ValueError("SQL query contains invalid characters.")
    if cleaned.endswith(";"):
        cleaned = cleaned[:-1].strip()
    if ";" in cleaned:
        raise ValueError("Only a single SELECT statement is allowed; multiple statements are not accepted.")
    if not READ_ONLY_SQL_START_RE.search(cleaned):
        raise ValueError("Only SELECT or WITH queries are allowed.")
    if FORBIDDEN_SQL_RE.search(cleaned):
        raise ValueError("Query contains a forbidden SQL keyword. Only read-only SELECT queries are allowed.")
    if FORBIDDEN_SQL_TARGET_RE.search(cleaned):
        raise ValueError("Query targets a schema or table that is not available to the finance query tool.")
    return cleaned


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


async def run_finance_query(sql: str, max_rows: int = 100) -> dict[str, Any]:
    sql = _validate_read_only_sql(sql)
    max_rows = max(1, min(int(max_rows), 200))
    limited_sql = f"SELECT * FROM ({sql}) AS llm_finance_query LIMIT :max_rows"
    if LLMSessionLocal is None:
        raise RuntimeError("LLM_DATABASE_URL is not configured for the read-only finance query tool.")

    async with LLMSessionLocal() as session:
        await session.execute(text("SET TRANSACTION READ ONLY"))
        await session.execute(text("SET LOCAL statement_timeout = '5s'"))
        result = await session.execute(text(limited_sql), {"max_rows": max_rows})
        rows = [
            {key: _json_safe(value) for key, value in row.items()}
            for row in result.mappings().all()
        ]
        await session.rollback()

    return {
        "columns": list(rows[0].keys()) if rows else [],
        "rows": rows,
        "row_count": len(rows),
        "max_rows": max_rows,
        "truncated": len(rows) == max_rows,
    }


async def query_finance_db_tool(arguments: dict[str, Any], context: ToolExecutionContext) -> dict[str, Any]:
    sql = _validate_read_only_sql(str(arguments.get("sql") or ""))
    max_rows = arguments.get("max_rows", 100)
    try:
        max_rows = int(max_rows)
    except (TypeError, ValueError) as exc:
        raise ValueError("max_rows must be an integer.") from exc
    result = await run_finance_query(sql, max_rows)
    context.latest_finance_query_sql = sql
    return result


async def render_chart_tool(arguments: dict[str, Any], context: ToolExecutionContext) -> dict[str, Any]:
    chart_arguments = dict(arguments)
    source_query_sql = str(chart_arguments.get("source_query_sql") or context.latest_finance_query_sql or "").strip()
    if "data" not in chart_arguments and source_query_sql:
        query_result = await run_finance_query(source_query_sql, 200)
        rows = query_result["rows"]
        if not rows:
            raise ValueError("The chart source query returned no rows.")
        chart_arguments["data"] = rows
        chart_arguments["source_query_sql"] = source_query_sql

    chart = ChatChart.model_validate(chart_arguments)
    if chart.source_query_sql is None and source_query_sql:
        chart = chart.model_copy(update={"source_query_sql": source_query_sql})
    context.emit_artifact(ChatArtifact(type="chart", chart=chart))
    return {
        "status": "chart_recorded",
        "chart_id": chart.id,
        "chart_type": chart.type,
        "title": chart.title,
    }


async def add_task_to_board_tool(arguments: dict[str, Any], context: ToolExecutionContext) -> dict[str, Any]:
    task = ChatTask.model_validate(arguments)
    context.emit_artifact(ChatArtifact(type="task", task=task))
    return {
        "status": "task_recorded",
        "task_id": task.id,
        "task": task.model_dump(mode="json"),
        "title": task.title,
        "owner_name": task.owner_name,
        "priority": task.priority,
        "task_status": task.status,
    }


def build_tool_registry() -> ToolRegistry:
    return ToolRegistry(
        tools=[
            ChatTool(
                name="query_finance_db",
                description=(
                    "Run a read-only PostgreSQL SELECT query against the finance warehouse. "
                    "Use this to answer questions using actual finance data from mart and selected core/meta tables. "
                    "Prefer mart views for analytical summaries. The tool rejects writes, semicolons, and non-finance schemas."
                ),
                input_schema={
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "sql": {
                            "type": "string",
                            "description": "A single read-only PostgreSQL SELECT or WITH query. Use fully-qualified finance warehouse tables/views.",
                        },
                        "max_rows": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 200,
                            "description": "Maximum rows to return. Defaults to 100.",
                        },
                    },
                    "required": ["sql"],
                },
                handler=query_finance_db_tool,
            ),
            ChatTool(
                name="render_chart",
                description=(
                    "Create a chart artifact for the frontend sidebar. "
                    "Use this when a visual helps explain the answer. "
                    "Supported chart types: line, bar, area, pie. "
                    "Include non-empty data, or include source_query_sql so the tool can fetch the chart data from the finance warehouse. "
                    "For line/bar/area charts include x_key and at least one series, and every data row must include numeric values for each series key. "
                    "For pie charts include label_key and value_key, and every data row must include a label plus a numeric value."
                ),
                input_schema={
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {"type": "string"},
                        "type": {"type": "string", "enum": ["line", "bar", "area", "pie"]},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": ["string", "number", "boolean", "null"]
                                },
                            },
                        },
                        "series": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "key": {"type": "string"},
                                    "label": {"type": "string"},
                                    "color": {"type": "string"},
                                },
                                "required": ["key", "label"],
                            },
                        },
                        "x_key": {"type": "string"},
                        "label_key": {"type": "string"},
                        "value_key": {"type": "string"},
                        "stacked": {"type": "boolean"},
                        "source_query_sql": {
                            "type": "string",
                            "description": "The read-only finance SQL query used to produce this chart data. Include the exact query_finance_db SQL when available.",
                        },
                    },
                    "required": ["type", "title"],
                },
                handler=render_chart_tool,
            ),
            ChatTool(
                name="add_task_to_board",
                description=(
                    "Add a concrete follow-up task to the user's task board when the user asks to capture work, "
                    "assign an action item, make a follow-up, or when the conversation clearly identifies an execution task. "
                    "Use concise action-oriented titles. Prefer backlog status unless the user explicitly says work is underway, "
                    "ready for review, or already complete."
                ),
                input_schema={
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "Optional stable unique ID. Omit this unless one is already available.",
                        },
                        "title": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 160,
                            "description": "A concise action-oriented task title.",
                        },
                        "owner_id": {
                            "type": ["integer", "null"],
                            "description": "Known numeric owner ID, or null if unknown.",
                        },
                        "owner_name": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 120,
                            "description": "Assignee display name. Use Unassigned if no owner is clear.",
                        },
                        "priority": {
                            "type": "string",
                            "enum": ["High", "Medium", "Low"],
                            "description": "Task priority inferred from urgency and impact.",
                        },
                        "status": {
                            "type": "string",
                            "enum": ["backlog", "in_progress", "review", "done"],
                            "description": "Workflow status. Default to backlog unless the user clearly indicates another state.",
                        },
                    },
                    "required": ["title"],
                },
                handler=add_task_to_board_tool,
            )
        ]
    )
