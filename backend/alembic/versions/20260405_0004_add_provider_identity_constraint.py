"""add provider identity constraint"""

from alembic import op


revision = "20260405_0004"
down_revision = "20260405_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_users_provider_provider_account_id",
        "users",
        ["provider", "provider_account_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_provider_provider_account_id", "users", type_="unique")
