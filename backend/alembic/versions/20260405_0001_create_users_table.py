"""create users table"""

from alembic import op
import sqlalchemy as sa


revision = "20260405_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("image", sa.String(length=1024), nullable=True),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("provider_account_id", sa.String(length=255), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_provider"), "users", ["provider"], unique=False)
    op.create_index(
        op.f("ix_users_provider_account_id"),
        "users",
        ["provider_account_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_provider_account_id"), table_name="users")
    op.drop_index(op.f("ix_users_provider"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
