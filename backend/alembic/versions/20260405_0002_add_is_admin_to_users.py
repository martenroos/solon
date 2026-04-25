"""add is_admin to users"""

from alembic import op
import sqlalchemy as sa


revision = "20260405_0002"
down_revision = "20260405_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.alter_column("users", "is_admin", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_admin")
