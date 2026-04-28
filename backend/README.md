# Solon Backend

Minimal FastAPI scaffold for the Solon platform.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
docker compose up -d postgres
alembic upgrade head
uvicorn app.main:app --reload
```

## Endpoints

- `GET /health`
- `GET /api/v1/status`
- `POST /api/v1/auth/sync-user`
- `GET /api/v1/auth/me`
- `GET /api/v1/chat/capabilities`
- `POST /api/v1/chat/respond`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{user_id}`

## Chat configuration

Chat uses env-backed settings and is designed to leave clear seams for tool calling and future multi-agent orchestration.

Example `.env` values:

```env
FRONTEND_INTERNAL_API_KEY=change-me
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_SYSTEM_PROMPT="You are Solon Analyst, a finance-focused assistant."
LLM_REQUEST_TIMEOUT_SECONDS=60
LLM_MAX_OUTPUT_TOKENS=1200
LLM_MAX_TOOL_ROUND_TRIPS=4
LLM_DATABASE_URL=postgresql+asyncpg://solon_llm_readonly:change-me-readonly@localhost:5432/solon
```

Supported aliases:

- `OPENAI_API_KEY` or `LLM_API_KEY`
- `OPENAI_MODEL` or `LLM_MODEL`
- `OPENAI_BASE_URL` or `LLM_BASE_URL`

Azure OpenAI is also supported:

```env
OPENAI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4.1-nano
AZURE_OPENAI_API_VERSION=2024-10-21
```

To call chat routes from the frontend, send:

- `X-Internal-API-Key`
- `X-User-Email`

### LLM database access

The finance database query tool uses `LLM_DATABASE_URL`, not the normal app `DATABASE_URL`. Configure it with a dedicated read-only Postgres role:

```bash
python -m app.scripts.setup_llm_readonly_role --password change-me-readonly
```

The script grants read access to `mart`, selected finance tables in `core`, and selected sync metadata in `meta`. The role is configured with `default_transaction_read_only`, a short statement timeout, and no access to auth or chat tables.

## Migrations

```bash
alembic upgrade head
alembic revision --autogenerate -m "describe change"
```

## Finance Warehouse V1

The backend now reserves a first warehouse slice for connector-agnostic finance data:

- `meta`: source systems, company connections, sync runs, and cursors
- `raw`: lightweight retained payloads for replay and debugging
- `core`: canonical finance dimensions and facts
- `mart`: stable analytical views for BI and AI querying

The first migration intentionally ships a trimmed v1:

- canonical backbone: `core.fact_journal_entry`, `core.fact_journal_entry_line`
- supporting dimensions: company, date, currency, counterparty, ledger account, org unit, journal, tax code
- operational facts: sales invoices, purchase invoices, open item snapshots, budgets
- source mapping tables for connector-level identity
- initial marts for trial balance, P&L, budget vs actual, AR/AP aging, and freshness

This is designed so Exact and AFAS can both map into the same warehouse without making Exact-specific tables the source of truth.

### Demo finance seed data

After running migrations, populate the warehouse with realistic demo data:

```bash
python -m app.scripts.seed_finance_demo
```

The seed resets and recreates the `SOLON-DEMO` company by default. It inserts a chart of accounts, counterparties, org units, journals, tax codes, sales and purchase invoices, journal entries, open AR/AP snapshots, budgets, raw payloads, and sync metadata. Use `--year YYYY` to seed another fiscal year.

### Finance analytics signals

Dashboard and insights predictions/anomalies are persisted in `mart.analytics_run` and `mart.insight_signal`. Compute them after ingestion or on a scheduler:

```bash
python -m app.scripts.compute_finance_analytics
```

The finance API will also refresh stale or missing signals on demand, but production deployments should run the script after warehouse loads so pages read from completed analytics runs.
