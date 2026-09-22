"""add projected flag to transactions

Revision ID: b7c9d2e4f601
Revises: a91c2d4e5f67
Create Date: 2026-09-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c9d2e4f601"
down_revision: Union[str, Sequence[str], None] = "a91c2d4e5f67"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_projected",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    op.create_index("ix_transactions_is_projected", "transactions", ["is_projected"])

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("is_projected", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_transactions_is_projected", table_name="transactions")
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("is_projected")
