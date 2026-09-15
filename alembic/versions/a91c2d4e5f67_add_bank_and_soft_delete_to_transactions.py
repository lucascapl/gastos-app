"""add bank and soft delete to transactions

Revision ID: a91c2d4e5f67
Revises: f3b8c7d9a2e1
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a91c2d4e5f67"
down_revision: Union[str, Sequence[str], None] = "f3b8c7d9a2e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add bank metadata and soft delete flags to transactions."""
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("bank", sa.String(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "is_deleted",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    op.create_index("ix_transactions_is_deleted", "transactions", ["is_deleted"])

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("is_deleted", server_default=None)


def downgrade() -> None:
    """Remove bank metadata and soft delete flags."""
    op.drop_index("ix_transactions_is_deleted", table_name="transactions")
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("is_deleted")
        batch_op.drop_column("bank")
