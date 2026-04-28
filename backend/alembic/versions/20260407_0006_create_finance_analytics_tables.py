"""create finance analytics tables"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260407_0006"
down_revision = "20260407_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS mart")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "analytics_run",
        sa.Column("analytics_run_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'running'")),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("input_fingerprint", sa.String(length=128), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.PrimaryKeyConstraint("analytics_run_id"),
        schema="mart",
    )
    op.create_index(
        "idx_mart_analytics_run_company_type_completed",
        "analytics_run",
        ["company_id", "run_type", "completed_at"],
        unique=False,
        schema="mart",
    )

    op.create_table(
        "insight_signal",
        sa.Column("insight_signal_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("analytics_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signal_id", sa.String(length=100), nullable=False),
        sa.Column("signal_type", sa.String(length=40), nullable=False),
        sa.Column("model_name", sa.String(length=120), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("method", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("risk_score", sa.Numeric(8, 4), nullable=False),
        sa.Column("confidence_score", sa.Numeric(8, 4), nullable=False),
        sa.Column("metric_label", sa.String(length=80), nullable=False),
        sa.Column("metric_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("metric_text", sa.String(length=80), nullable=False),
        sa.Column("delta_text", sa.String(length=120), nullable=False),
        sa.Column("delta_direction", sa.String(length=20), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("evidence_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("trend_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("segments_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("signal_type IN ('metric', 'prediction', 'anomaly')", name="ck_mart_insight_signal_type"),
        sa.CheckConstraint("status IN ('On track', 'Watch', 'Alert')", name="ck_mart_insight_signal_status"),
        sa.CheckConstraint("delta_direction IN ('up', 'down', 'flat')", name="ck_mart_insight_signal_delta_direction"),
        sa.ForeignKeyConstraint(["analytics_run_id"], ["mart.analytics_run.analytics_run_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["core.dim_company.company_id"]),
        sa.PrimaryKeyConstraint("insight_signal_id"),
        sa.UniqueConstraint("analytics_run_id", "signal_id", name="uq_mart_insight_signal_run_signal"),
        schema="mart",
    )
    op.create_index(
        "idx_mart_insight_signal_company_signal_created",
        "insight_signal",
        ["company_id", "signal_id", "created_at"],
        unique=False,
        schema="mart",
    )


def downgrade() -> None:
    op.drop_index("idx_mart_insight_signal_company_signal_created", table_name="insight_signal", schema="mart")
    op.drop_table("insight_signal", schema="mart")
    op.drop_index("idx_mart_analytics_run_company_type_completed", table_name="analytics_run", schema="mart")
    op.drop_table("analytics_run", schema="mart")
