"""create saved chart widgets"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0007"
down_revision = "20260407_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_chart_widgets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("surface", sa.String(length=32), nullable=False),
        sa.Column("chart_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("chart_type", sa.String(length=16), nullable=False),
        sa.Column("source_query_sql", sa.Text(), nullable=False),
        sa.Column("chart_config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "chart_id", "surface", name="uq_saved_chart_widgets_user_chart_surface"),
    )
    op.create_index(op.f("ix_saved_chart_widgets_surface"), "saved_chart_widgets", ["surface"], unique=False)
    op.create_index(op.f("ix_saved_chart_widgets_user_id"), "saved_chart_widgets", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_chart_widgets_user_id"), table_name="saved_chart_widgets")
    op.drop_index(op.f("ix_saved_chart_widgets_surface"), table_name="saved_chart_widgets")
    op.drop_table("saved_chart_widgets")
