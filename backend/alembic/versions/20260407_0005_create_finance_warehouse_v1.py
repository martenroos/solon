"""create finance warehouse v1"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260407_0005"
down_revision = "20260405_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE SCHEMA IF NOT EXISTS meta")
    op.execute("CREATE SCHEMA IF NOT EXISTS raw")
    op.execute("CREATE SCHEMA IF NOT EXISTS core")
    op.execute("CREATE SCHEMA IF NOT EXISTS mart")

    op.create_table(
        "source_system",
        sa.Column("source_system_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_code", sa.String(length=50), nullable=False),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column("source_family", sa.String(length=100), nullable=True),
        sa.Column("api_version", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("source_system_id"),
        sa.UniqueConstraint("source_code", name="uq_meta_source_system_source_code"),
        schema="meta",
    )

    op.create_table(
        "dim_company",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_code", sa.String(length=100), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("legal_entity_name", sa.String(length=255), nullable=True),
        sa.Column("country_code", sa.String(length=10), nullable=True),
        sa.Column("base_currency_code", sa.String(length=10), nullable=False),
        sa.Column("fiscal_year_start_month", sa.SmallInteger(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("fiscal_year_start_month BETWEEN 1 AND 12", name="ck_core_dim_company_fiscal_year_start_month"),
        sa.PrimaryKeyConstraint("company_id"),
        sa.UniqueConstraint("company_code", name="uq_core_dim_company_company_code"),
        schema="core",
    )

    op.create_table(
        "dim_date",
        sa.Column("date_key", sa.Date(), nullable=False),
        sa.Column("year_number", sa.Integer(), nullable=False),
        sa.Column("quarter_number", sa.Integer(), nullable=False),
        sa.Column("month_number", sa.Integer(), nullable=False),
        sa.Column("month_name", sa.String(length=20), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("day_of_month", sa.Integer(), nullable=False),
        sa.Column("day_of_week_iso", sa.Integer(), nullable=False),
        sa.Column("day_name", sa.String(length=20), nullable=False),
        sa.Column("is_weekend", sa.Boolean(), nullable=False),
        sa.Column("is_month_end", sa.Boolean(), nullable=False),
        sa.Column("fiscal_year_number", sa.Integer(), nullable=False),
        sa.Column("fiscal_period_number", sa.Integer(), nullable=False),
        sa.Column("fiscal_quarter_number", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("date_key"),
        schema="core",
    )

    op.create_table(
        "dim_currency",
        sa.Column("currency_code", sa.String(length=10), nullable=False),
        sa.Column("currency_name", sa.String(length=100), nullable=True),
        sa.Column("currency_symbol", sa.String(length=10), nullable=True),
        sa.Column("decimal_places", sa.SmallInteger(), nullable=False, server_default=sa.text("2")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("currency_code"),
        schema="core",
    )

    op.create_table(
        "dim_document_type",
        sa.Column("document_type_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_type_code", sa.String(length=50), nullable=False),
        sa.Column("document_type_name", sa.String(length=100), nullable=False),
        sa.Column("document_category", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("document_type_id"),
        sa.UniqueConstraint("document_type_code", name="uq_core_dim_document_type_document_type_code"),
        schema="core",
    )

    op.create_table(
        "company_source_connection",
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_system_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_tenant_key", sa.String(length=255), nullable=True),
        sa.Column("source_company_key", sa.String(length=255), nullable=True),
        sa.Column("connection_name", sa.String(length=255), nullable=True),
        sa.Column("is_primary_for_company", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("connection_status", sa.String(length=50), nullable=False, server_default=sa.text("'active'")),
        sa.Column("first_connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_successful_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(["source_system_id"], ["meta.source_system.source_system_id"]),
        sa.PrimaryKeyConstraint("company_source_connection_id"),
        schema="meta",
    )
    op.create_index(
        "uq_meta_company_source_connection_tenant",
        "company_source_connection",
        ["company_id", "source_system_id", sa.text("COALESCE(source_tenant_key, '')")],
        unique=True,
        schema="meta",
    )

    op.create_table(
        "sync_run",
        sa.Column("sync_run_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_system_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("object_type", sa.String(length=255), nullable=False),
        sa.Column("sync_mode", sa.String(length=50), nullable=False),
        sa.Column("sync_status", sa.String(length=50), nullable=False),
        sa.Column("cursor_value", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rows_read", sa.BigInteger(), nullable=True),
        sa.Column("rows_loaded", sa.BigInteger(), nullable=True),
        sa.Column("rows_rejected", sa.BigInteger(), nullable=True),
        sa.Column("rows_deleted", sa.BigInteger(), nullable=True),
        sa.Column("checksum_value", sa.String(length=128), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(["source_system_id"], ["meta.source_system.source_system_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.PrimaryKeyConstraint("sync_run_id"),
        schema="meta",
    )
    op.create_index(
        "idx_meta_sync_run_company_connection_object_started",
        "sync_run",
        ["company_id", "company_source_connection_id", "object_type", "started_at"],
        unique=False,
        schema="meta",
    )

    op.create_table(
        "sync_cursor",
        sa.Column("sync_cursor_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_system_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("object_type", sa.String(length=255), nullable=False),
        sa.Column("cursor_type", sa.String(length=50), nullable=False),
        sa.Column("cursor_value", sa.Text(), nullable=True),
        sa.Column("last_successful_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(["source_system_id"], ["meta.source_system.source_system_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.PrimaryKeyConstraint("sync_cursor_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "object_type",
            name="uq_meta_sync_cursor_connection_object_type",
        ),
        schema="meta",
    )

    op.create_table(
        "raw_object",
        sa.Column("raw_object_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sync_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_system_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("object_type", sa.String(length=255), nullable=False),
        sa.Column("source_endpoint", sa.String(length=500), nullable=True),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_parent_record_id", sa.String(length=255), nullable=True),
        sa.Column("source_line_id", sa.String(length=255), nullable=True),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pulled_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_deleted_in_source", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["sync_run_id"], ["meta.sync_run.sync_run_id"]),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(["source_system_id"], ["meta.source_system.source_system_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.PrimaryKeyConstraint("raw_object_id"),
        schema="raw",
    )
    op.create_index(
        "idx_raw_object_lookup",
        "raw_object",
        ["company_source_connection_id", "object_type", "source_record_id"],
        unique=False,
        schema="raw",
    )
    op.create_index(
        "uq_raw_object_snapshot_record",
        "raw_object",
        [
            "company_source_connection_id",
            "object_type",
            "source_record_id",
            sa.text("COALESCE(source_line_id, '')"),
            sa.text("COALESCE(snapshot_at, 'infinity'::timestamptz)"),
        ],
        unique=True,
        schema="raw",
    )
    op.create_index(
        "idx_raw_object_snapshot",
        "raw_object",
        ["company_source_connection_id", "object_type", "snapshot_at"],
        unique=False,
        schema="raw",
    )
    op.execute("CREATE INDEX idx_raw_object_payload_gin ON raw.raw_object USING GIN(payload_json)")

    op.create_table(
        "dim_counterparty",
        sa.Column("counterparty_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("counterparty_code", sa.String(length=100), nullable=True),
        sa.Column("counterparty_name", sa.String(length=255), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("counterparty_type", sa.String(length=50), nullable=True),
        sa.Column("is_customer", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_supplier", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_employee", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_intercompany", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("country_code", sa.String(length=10), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("tax_registration_number", sa.String(length=100), nullable=True),
        sa.Column("chamber_of_commerce_number", sa.String(length=100), nullable=True),
        sa.Column("payment_terms_days", sa.Integer(), nullable=True),
        sa.Column("credit_limit_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.PrimaryKeyConstraint("counterparty_id"),
        schema="core",
    )
    op.create_index(
        "idx_core_dim_counterparty_roles",
        "dim_counterparty",
        ["company_id", "is_customer", "is_supplier"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "map_source_counterparty",
        sa.Column("map_source_counterparty_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_code", sa.String(length=100), nullable=True),
        sa.Column("counterparty_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["counterparty_id"], ["core.dim_counterparty.counterparty_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("map_source_counterparty_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_record_id",
            name="uq_core_map_source_counterparty_connection_record",
        ),
        schema="core",
    )

    op.create_table(
        "dim_ledger_account",
        sa.Column("ledger_account_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_code", sa.String(length=100), nullable=True),
        sa.Column("account_name", sa.String(length=255), nullable=False),
        sa.Column("account_type", sa.String(length=50), nullable=True),
        sa.Column("account_class", sa.String(length=50), nullable=True),
        sa.Column("normal_balance_side", sa.String(length=10), nullable=True),
        sa.Column("reporting_group_lvl1", sa.String(length=100), nullable=True),
        sa.Column("reporting_group_lvl2", sa.String(length=100), nullable=True),
        sa.Column("reporting_group_lvl3", sa.String(length=100), nullable=True),
        sa.Column("cashflow_group", sa.String(length=100), nullable=True),
        sa.Column("is_control_account", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("allows_counterparty", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("allows_org_unit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_bank_account", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.PrimaryKeyConstraint("ledger_account_id"),
        schema="core",
    )
    op.create_index(
        "idx_core_dim_ledger_account_reporting",
        "dim_ledger_account",
        ["company_id", "account_class", "reporting_group_lvl1"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "map_source_ledger_account",
        sa.Column("map_source_ledger_account_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_code", sa.String(length=100), nullable=True),
        sa.Column("ledger_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["ledger_account_id"], ["core.dim_ledger_account.ledger_account_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("map_source_ledger_account_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_record_id",
            name="uq_core_map_source_ledger_account_connection_record",
        ),
        schema="core",
    )

    op.create_table(
        "dim_org_unit",
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_org_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("org_unit_code", sa.String(length=100), nullable=True),
        sa.Column("org_unit_name", sa.String(length=255), nullable=False),
        sa.Column("org_unit_type", sa.String(length=50), nullable=False),
        sa.Column("manager_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(["parent_org_unit_id"], ["core.dim_org_unit.org_unit_id"]),
        sa.PrimaryKeyConstraint("org_unit_id"),
        schema="core",
    )
    op.create_index(
        "idx_core_dim_org_unit_type",
        "dim_org_unit",
        ["company_id", "org_unit_type"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "map_source_org_unit",
        sa.Column("map_source_org_unit_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_code", sa.String(length=100), nullable=True),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["org_unit_id"], ["core.dim_org_unit.org_unit_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("map_source_org_unit_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_record_id",
            name="uq_core_map_source_org_unit_connection_record",
        ),
        schema="core",
    )

    op.create_table(
        "dim_journal",
        sa.Column("journal_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("journal_code", sa.String(length=100), nullable=True),
        sa.Column("journal_name", sa.String(length=255), nullable=False),
        sa.Column("journal_type", sa.String(length=50), nullable=True),
        sa.Column("currency_code", sa.String(length=10), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(["currency_code"], ["core.dim_currency.currency_code"]),
        sa.PrimaryKeyConstraint("journal_id"),
        schema="core",
    )

    op.create_table(
        "map_source_journal",
        sa.Column("map_source_journal_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_code", sa.String(length=100), nullable=True),
        sa.Column("journal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["journal_id"], ["core.dim_journal.journal_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("map_source_journal_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_record_id",
            name="uq_core_map_source_journal_connection_record",
        ),
        schema="core",
    )

    op.create_table(
        "dim_tax_code",
        sa.Column("tax_code_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tax_code", sa.String(length=100), nullable=True),
        sa.Column("tax_name", sa.String(length=255), nullable=True),
        sa.Column("tax_type", sa.String(length=50), nullable=True),
        sa.Column("tax_rate_pct", sa.Numeric(9, 4), nullable=True),
        sa.Column("recoverability_pct", sa.Numeric(9, 4), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.PrimaryKeyConstraint("tax_code_id"),
        schema="core",
    )

    op.create_table(
        "map_source_tax_code",
        sa.Column("map_source_tax_code_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_code", sa.String(length=100), nullable=True),
        sa.Column("tax_code_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["tax_code_id"], ["core.dim_tax_code.tax_code_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("map_source_tax_code_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_record_id",
            name="uq_core_map_source_tax_code_connection_record",
        ),
        schema="core",
    )

    op.create_table(
        "fact_journal_entry",
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_object_type", sa.String(length=255), nullable=False),
        sa.Column("journal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_type_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entry_number", sa.String(length=100), nullable=True),
        sa.Column("document_number", sa.String(length=100), nullable=True),
        sa.Column("external_reference", sa.String(length=255), nullable=True),
        sa.Column("posting_date", sa.Date(), nullable=False),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("fiscal_year_number", sa.Integer(), nullable=False),
        sa.Column("fiscal_period_number", sa.Integer(), nullable=False),
        sa.Column("entry_currency_code", sa.String(length=10), nullable=True),
        sa.Column("base_currency_code", sa.String(length=10), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default=sa.text("'posted'")),
        sa.Column("is_adjustment", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_opening_balance", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["journal_id"], ["core.dim_journal.journal_id"]),
        sa.ForeignKeyConstraint(["document_type_id"], ["core.dim_document_type.document_type_id"]),
        sa.ForeignKeyConstraint(["posting_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["document_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["due_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["entry_currency_code"], ["core.dim_currency.currency_code"]),
        sa.ForeignKeyConstraint(["base_currency_code"], ["core.dim_currency.currency_code"]),
        sa.PrimaryKeyConstraint("journal_entry_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_object_type",
            "source_record_id",
            name="uq_core_fact_journal_entry_connection_object_record",
        ),
        schema="core",
    )
    op.create_index(
        "idx_core_fact_journal_entry_period",
        "fact_journal_entry",
        ["company_id", "fiscal_year_number", "fiscal_period_number", "posting_date"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "fact_journal_entry_line",
        sa.Column("journal_entry_line_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_line_id", sa.String(length=255), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("ledger_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("counterparty_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tax_code_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_type_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("posting_date", sa.Date(), nullable=False),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("fiscal_year_number", sa.Integer(), nullable=False),
        sa.Column("fiscal_period_number", sa.Integer(), nullable=False),
        sa.Column("debit_amount_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("credit_amount_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("signed_amount_base", sa.Numeric(18, 2), nullable=False),
        sa.Column("transaction_currency_code", sa.String(length=10), nullable=True),
        sa.Column("transaction_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("base_currency_code", sa.String(length=10), nullable=True),
        sa.Column("tax_amount_base", sa.Numeric(18, 2), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("unit_price_base", sa.Numeric(18, 4), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_document_number", sa.String(length=100), nullable=True),
        sa.Column("source_document_line_ref", sa.String(length=100), nullable=True),
        sa.Column("is_reversal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_statistical", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "ROUND(COALESCE(debit_amount_base, 0) - COALESCE(credit_amount_base, 0), 2) = ROUND(signed_amount_base, 2)",
            name="ck_core_fact_journal_entry_line_signed_consistency",
        ),
        sa.ForeignKeyConstraint(["journal_entry_id"], ["core.fact_journal_entry.journal_entry_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["ledger_account_id"], ["core.dim_ledger_account.ledger_account_id"]),
        sa.ForeignKeyConstraint(["counterparty_id"], ["core.dim_counterparty.counterparty_id"]),
        sa.ForeignKeyConstraint(["org_unit_id"], ["core.dim_org_unit.org_unit_id"]),
        sa.ForeignKeyConstraint(["tax_code_id"], ["core.dim_tax_code.tax_code_id"]),
        sa.ForeignKeyConstraint(["document_type_id"], ["core.dim_document_type.document_type_id"]),
        sa.ForeignKeyConstraint(["posting_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["document_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["due_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["transaction_currency_code"], ["core.dim_currency.currency_code"]),
        sa.ForeignKeyConstraint(["base_currency_code"], ["core.dim_currency.currency_code"]),
        sa.PrimaryKeyConstraint("journal_entry_line_id"),
        schema="core",
    )
    op.create_index(
        "uq_core_fact_journal_entry_line_connection_record",
        "fact_journal_entry_line",
        [
            "company_source_connection_id",
            "source_record_id",
            sa.text("COALESCE(source_line_id, '')"),
        ],
        unique=True,
        schema="core",
    )
    op.create_index(
        "idx_core_fact_jel_period",
        "fact_journal_entry_line",
        ["company_id", "fiscal_year_number", "fiscal_period_number", "posting_date"],
        unique=False,
        schema="core",
    )
    op.create_index(
        "idx_core_fact_jel_ledger",
        "fact_journal_entry_line",
        ["company_id", "ledger_account_id", "posting_date"],
        unique=False,
        schema="core",
    )
    op.create_index(
        "idx_core_fact_jel_counterparty",
        "fact_journal_entry_line",
        ["company_id", "counterparty_id", "posting_date"],
        unique=False,
        schema="core",
    )
    op.create_index(
        "idx_core_fact_jel_org_unit",
        "fact_journal_entry_line",
        ["company_id", "org_unit_id", "posting_date"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "fact_sales_invoice",
        sa.Column("sales_invoice_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("journal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invoice_number", sa.String(length=100), nullable=True),
        sa.Column("external_reference", sa.String(length=255), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("posting_date", sa.Date(), nullable=True),
        sa.Column("fiscal_year_number", sa.Integer(), nullable=True),
        sa.Column("fiscal_period_number", sa.Integer(), nullable=True),
        sa.Column("currency_code", sa.String(length=10), nullable=True),
        sa.Column("amount_excl_tax_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("tax_amount_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("amount_incl_tax_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["core.dim_counterparty.counterparty_id"]),
        sa.ForeignKeyConstraint(["journal_id"], ["core.dim_journal.journal_id"]),
        sa.ForeignKeyConstraint(["invoice_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["due_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["posting_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["currency_code"], ["core.dim_currency.currency_code"]),
        sa.ForeignKeyConstraint(["journal_entry_id"], ["core.fact_journal_entry.journal_entry_id"]),
        sa.PrimaryKeyConstraint("sales_invoice_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_record_id",
            name="uq_core_fact_sales_invoice_connection_record",
        ),
        schema="core",
    )
    op.create_index(
        "idx_core_fact_sales_invoice_customer",
        "fact_sales_invoice",
        ["company_id", "customer_id", "invoice_date"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "fact_purchase_invoice",
        sa.Column("purchase_invoice_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("journal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invoice_number", sa.String(length=100), nullable=True),
        sa.Column("external_reference", sa.String(length=255), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("posting_date", sa.Date(), nullable=True),
        sa.Column("fiscal_year_number", sa.Integer(), nullable=True),
        sa.Column("fiscal_period_number", sa.Integer(), nullable=True),
        sa.Column("currency_code", sa.String(length=10), nullable=True),
        sa.Column("amount_excl_tax_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("tax_amount_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("amount_incl_tax_base", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["supplier_id"], ["core.dim_counterparty.counterparty_id"]),
        sa.ForeignKeyConstraint(["journal_id"], ["core.dim_journal.journal_id"]),
        sa.ForeignKeyConstraint(["invoice_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["due_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["posting_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["currency_code"], ["core.dim_currency.currency_code"]),
        sa.ForeignKeyConstraint(["journal_entry_id"], ["core.fact_journal_entry.journal_entry_id"]),
        sa.PrimaryKeyConstraint("purchase_invoice_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "source_record_id",
            name="uq_core_fact_purchase_invoice_connection_record",
        ),
        schema="core",
    )
    op.create_index(
        "idx_core_fact_purchase_invoice_supplier",
        "fact_purchase_invoice",
        ["company_id", "supplier_id", "invoice_date"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "fact_open_item_snapshot",
        sa.Column("open_item_snapshot_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("item_type", sa.String(length=20), nullable=False),
        sa.Column("counterparty_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sales_invoice_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("purchase_invoice_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_number", sa.String(length=100), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("currency_code", sa.String(length=10), nullable=True),
        sa.Column("original_amount_base", sa.Numeric(18, 2), nullable=True),
        sa.Column("open_amount_base", sa.Numeric(18, 2), nullable=False),
        sa.Column("days_overdue", sa.Integer(), nullable=True),
        sa.Column("aging_bucket", sa.String(length=20), nullable=True),
        sa.Column("is_overdue", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("item_type IN ('receivable', 'payable')", name="ck_core_fact_open_item_snapshot_item_type"),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["counterparty_id"], ["core.dim_counterparty.counterparty_id"]),
        sa.ForeignKeyConstraint(["sales_invoice_id"], ["core.fact_sales_invoice.sales_invoice_id"]),
        sa.ForeignKeyConstraint(["purchase_invoice_id"], ["core.fact_purchase_invoice.purchase_invoice_id"]),
        sa.ForeignKeyConstraint(["invoice_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["due_date"], ["core.dim_date.date_key"]),
        sa.ForeignKeyConstraint(["currency_code"], ["core.dim_currency.currency_code"]),
        sa.PrimaryKeyConstraint("open_item_snapshot_id"),
        sa.UniqueConstraint(
            "company_source_connection_id",
            "snapshot_at",
            "item_type",
            "source_record_id",
            name="uq_core_fact_open_item_snapshot_connection_snapshot_record",
        ),
        schema="core",
    )
    op.create_index(
        "idx_core_fact_open_item_snapshot_main",
        "fact_open_item_snapshot",
        ["company_id", "item_type", "snapshot_at", "due_date"],
        unique=False,
        schema="core",
    )

    op.create_table(
        "fact_budget",
        sa.Column("budget_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_source_connection_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_record_id", sa.String(length=255), nullable=True),
        sa.Column("budget_name", sa.String(length=255), nullable=True),
        sa.Column("scenario_name", sa.String(length=255), nullable=True),
        sa.Column("ledger_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("date_key", sa.Date(), nullable=False),
        sa.Column("fiscal_year_number", sa.Integer(), nullable=False),
        sa.Column("fiscal_period_number", sa.Integer(), nullable=False),
        sa.Column("amount_base", sa.Numeric(18, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.ForeignKeyConstraint(
            ["company_source_connection_id"],
            ["meta.company_source_connection.company_source_connection_id"],
        ),
        sa.ForeignKeyConstraint(["ledger_account_id"], ["core.dim_ledger_account.ledger_account_id"]),
        sa.ForeignKeyConstraint(["org_unit_id"], ["core.dim_org_unit.org_unit_id"]),
        sa.ForeignKeyConstraint(["date_key"], ["core.dim_date.date_key"]),
        sa.PrimaryKeyConstraint("budget_id"),
        schema="core",
    )
    op.create_index(
        "idx_core_fact_budget_period",
        "fact_budget",
        ["company_id", "scenario_name", "fiscal_year_number", "fiscal_period_number"],
        unique=False,
        schema="core",
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW mart.v_trial_balance_by_period AS
        SELECT
            l.company_id,
            j.fiscal_year_number,
            j.fiscal_period_number,
            a.account_code,
            a.account_name,
            a.account_type,
            a.account_class,
            a.reporting_group_lvl1,
            a.reporting_group_lvl2,
            SUM(l.debit_amount_base) AS debit_amount_base,
            SUM(l.credit_amount_base) AS credit_amount_base,
            SUM(l.signed_amount_base) AS net_amount_base
        FROM core.fact_journal_entry_line l
        JOIN core.fact_journal_entry j
          ON j.journal_entry_id = l.journal_entry_id
        JOIN core.dim_ledger_account a
          ON a.ledger_account_id = l.ledger_account_id
        GROUP BY 1,2,3,4,5,6,7,8,9
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW mart.v_pl_by_period AS
        SELECT
            l.company_id,
            l.fiscal_year_number,
            l.fiscal_period_number,
            a.reporting_group_lvl1,
            a.reporting_group_lvl2,
            a.account_code,
            a.account_name,
            COALESCE(o.org_unit_name, 'Unassigned') AS org_unit_name,
            SUM(l.signed_amount_base) AS amount_base
        FROM core.fact_journal_entry_line l
        JOIN core.dim_ledger_account a
          ON a.ledger_account_id = l.ledger_account_id
        LEFT JOIN core.dim_org_unit o
          ON o.org_unit_id = l.org_unit_id
        WHERE a.account_type = 'profit_and_loss'
        GROUP BY 1,2,3,4,5,6,7,8
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW mart.v_budget_vs_actual AS
        SELECT
            b.company_id,
            b.scenario_name,
            b.fiscal_year_number,
            b.fiscal_period_number,
            a.account_code,
            a.account_name,
            a.account_class,
            a.reporting_group_lvl1,
            a.reporting_group_lvl2,
            o.org_unit_name,
            b.amount_base AS budget_amount_base,
            COALESCE(SUM(l.signed_amount_base), 0) AS actual_amount_base,
            COALESCE(SUM(l.signed_amount_base), 0) - b.amount_base AS variance_amount_base,
            CASE
                WHEN b.amount_base = 0 THEN NULL
                ELSE ROUND((COALESCE(SUM(l.signed_amount_base), 0) / b.amount_base) * 100, 2)
            END AS actual_vs_budget_pct
        FROM core.fact_budget b
        JOIN core.dim_ledger_account a
          ON a.ledger_account_id = b.ledger_account_id
        LEFT JOIN core.dim_org_unit o
          ON o.org_unit_id = b.org_unit_id
        LEFT JOIN core.fact_journal_entry_line l
          ON l.company_id = b.company_id
         AND l.ledger_account_id = b.ledger_account_id
         AND COALESCE(l.org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
             = COALESCE(b.org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
         AND l.fiscal_year_number = b.fiscal_year_number
         AND l.fiscal_period_number = b.fiscal_period_number
        GROUP BY 1,2,3,4,5,6,7,8,9,10,11
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW mart.v_ar_aging_latest AS
        WITH latest_snapshot AS (
            SELECT company_id, MAX(snapshot_at) AS snapshot_at
            FROM core.fact_open_item_snapshot
            WHERE item_type = 'receivable'
            GROUP BY company_id
        )
        SELECT
            s.company_id,
            s.snapshot_at,
            c.counterparty_id,
            c.counterparty_name,
            COUNT(*) AS open_items,
            SUM(s.open_amount_base) AS total_open_amount_base,
            AVG(s.days_overdue) AS avg_days_overdue,
            SUM(CASE WHEN s.aging_bucket = 'current' THEN s.open_amount_base ELSE 0 END) AS current_amount,
            SUM(CASE WHEN s.aging_bucket = '1-30' THEN s.open_amount_base ELSE 0 END) AS overdue_1_30,
            SUM(CASE WHEN s.aging_bucket = '31-60' THEN s.open_amount_base ELSE 0 END) AS overdue_31_60,
            SUM(CASE WHEN s.aging_bucket = '61-90' THEN s.open_amount_base ELSE 0 END) AS overdue_61_90,
            SUM(CASE WHEN s.aging_bucket = '90+' THEN s.open_amount_base ELSE 0 END) AS overdue_90_plus
        FROM core.fact_open_item_snapshot s
        JOIN latest_snapshot ls
          ON ls.company_id = s.company_id
         AND ls.snapshot_at = s.snapshot_at
        LEFT JOIN core.dim_counterparty c
          ON c.counterparty_id = s.counterparty_id
        WHERE s.item_type = 'receivable'
        GROUP BY 1,2,3,4
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW mart.v_ap_aging_latest AS
        WITH latest_snapshot AS (
            SELECT company_id, MAX(snapshot_at) AS snapshot_at
            FROM core.fact_open_item_snapshot
            WHERE item_type = 'payable'
            GROUP BY company_id
        )
        SELECT
            s.company_id,
            s.snapshot_at,
            c.counterparty_id,
            c.counterparty_name,
            COUNT(*) AS open_items,
            SUM(s.open_amount_base) AS total_open_amount_base,
            AVG(s.days_overdue) AS avg_days_overdue,
            SUM(CASE WHEN s.aging_bucket = 'current' THEN s.open_amount_base ELSE 0 END) AS current_amount,
            SUM(CASE WHEN s.aging_bucket = '1-30' THEN s.open_amount_base ELSE 0 END) AS overdue_1_30,
            SUM(CASE WHEN s.aging_bucket = '31-60' THEN s.open_amount_base ELSE 0 END) AS overdue_31_60,
            SUM(CASE WHEN s.aging_bucket = '61-90' THEN s.open_amount_base ELSE 0 END) AS overdue_61_90,
            SUM(CASE WHEN s.aging_bucket = '90+' THEN s.open_amount_base ELSE 0 END) AS overdue_90_plus
        FROM core.fact_open_item_snapshot s
        JOIN latest_snapshot ls
          ON ls.company_id = s.company_id
         AND ls.snapshot_at = s.snapshot_at
        LEFT JOIN core.dim_counterparty c
          ON c.counterparty_id = s.counterparty_id
        WHERE s.item_type = 'payable'
        GROUP BY 1,2,3,4
        """
    )
    op.execute(
        """
        CREATE OR REPLACE VIEW mart.v_data_freshness AS
        SELECT
            c.company_id,
            c.company_name,
            ss.source_code,
            sc.object_type,
            MAX(sr.finished_at) FILTER (WHERE sr.sync_status = 'success') AS last_successful_sync_at,
            MAX(ro.pulled_at) AS last_raw_pull_at
        FROM core.dim_company c
        LEFT JOIN meta.company_source_connection csc
          ON csc.company_id = c.company_id
        LEFT JOIN meta.source_system ss
          ON ss.source_system_id = csc.source_system_id
        LEFT JOIN meta.sync_cursor sc
          ON sc.company_source_connection_id = csc.company_source_connection_id
        LEFT JOIN meta.sync_run sr
          ON sr.company_source_connection_id = csc.company_source_connection_id
         AND sr.object_type = sc.object_type
        LEFT JOIN raw.raw_object ro
          ON ro.company_source_connection_id = csc.company_source_connection_id
         AND ro.object_type = sc.object_type
        GROUP BY 1,2,3,4
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS mart.v_data_freshness")
    op.execute("DROP VIEW IF EXISTS mart.v_ap_aging_latest")
    op.execute("DROP VIEW IF EXISTS mart.v_ar_aging_latest")
    op.execute("DROP VIEW IF EXISTS mart.v_budget_vs_actual")
    op.execute("DROP VIEW IF EXISTS mart.v_pl_by_period")
    op.execute("DROP VIEW IF EXISTS mart.v_trial_balance_by_period")

    op.drop_index("idx_core_fact_budget_period", table_name="fact_budget", schema="core")
    op.drop_table("fact_budget", schema="core")

    op.drop_index("idx_core_fact_open_item_snapshot_main", table_name="fact_open_item_snapshot", schema="core")
    op.drop_table("fact_open_item_snapshot", schema="core")

    op.drop_index("idx_core_fact_purchase_invoice_supplier", table_name="fact_purchase_invoice", schema="core")
    op.drop_table("fact_purchase_invoice", schema="core")

    op.drop_index("idx_core_fact_sales_invoice_customer", table_name="fact_sales_invoice", schema="core")
    op.drop_table("fact_sales_invoice", schema="core")

    op.drop_index("idx_core_fact_jel_org_unit", table_name="fact_journal_entry_line", schema="core")
    op.drop_index("idx_core_fact_jel_counterparty", table_name="fact_journal_entry_line", schema="core")
    op.drop_index("idx_core_fact_jel_ledger", table_name="fact_journal_entry_line", schema="core")
    op.drop_index("idx_core_fact_jel_period", table_name="fact_journal_entry_line", schema="core")
    op.drop_index("uq_core_fact_journal_entry_line_connection_record", table_name="fact_journal_entry_line", schema="core")
    op.drop_table("fact_journal_entry_line", schema="core")

    op.drop_index("idx_core_fact_journal_entry_period", table_name="fact_journal_entry", schema="core")
    op.drop_table("fact_journal_entry", schema="core")

    op.drop_table("map_source_tax_code", schema="core")
    op.drop_table("dim_tax_code", schema="core")

    op.drop_table("map_source_journal", schema="core")
    op.drop_table("dim_journal", schema="core")

    op.drop_table("map_source_org_unit", schema="core")
    op.drop_index("idx_core_dim_org_unit_type", table_name="dim_org_unit", schema="core")
    op.drop_table("dim_org_unit", schema="core")

    op.drop_table("map_source_ledger_account", schema="core")
    op.drop_index("idx_core_dim_ledger_account_reporting", table_name="dim_ledger_account", schema="core")
    op.drop_table("dim_ledger_account", schema="core")

    op.drop_table("map_source_counterparty", schema="core")
    op.drop_index("idx_core_dim_counterparty_roles", table_name="dim_counterparty", schema="core")
    op.drop_table("dim_counterparty", schema="core")

    op.execute("DROP INDEX IF EXISTS raw.idx_raw_object_payload_gin")
    op.drop_index("idx_raw_object_snapshot", table_name="raw_object", schema="raw")
    op.drop_index("uq_raw_object_snapshot_record", table_name="raw_object", schema="raw")
    op.drop_index("idx_raw_object_lookup", table_name="raw_object", schema="raw")
    op.drop_table("raw_object", schema="raw")

    op.drop_table("sync_cursor", schema="meta")
    op.drop_index("idx_meta_sync_run_company_connection_object_started", table_name="sync_run", schema="meta")
    op.drop_table("sync_run", schema="meta")
    op.drop_index("uq_meta_company_source_connection_tenant", table_name="company_source_connection", schema="meta")
    op.drop_table("company_source_connection", schema="meta")

    op.drop_table("dim_document_type", schema="core")
    op.drop_table("dim_currency", schema="core")
    op.drop_table("dim_date", schema="core")
    op.drop_table("dim_company", schema="core")
    op.drop_table("source_system", schema="meta")

    op.execute("DROP SCHEMA IF EXISTS mart")
    op.execute("DROP SCHEMA IF EXISTS raw")
    op.execute("DROP SCHEMA IF EXISTS meta")
    op.execute("DROP SCHEMA IF EXISTS core")
