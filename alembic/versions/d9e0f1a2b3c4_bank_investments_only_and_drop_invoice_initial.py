"""bank investments only and drop invoice initial

Revision ID: d9e0f1a2b3c4
Revises: c8d1e2f3a4b5
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e0f1a2b3c4"
down_revision: Union[str, Sequence[str], None] = "c8d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("banks") as batch_op:
        batch_op.add_column(
            sa.Column(
                "investments_only",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    with op.batch_alter_table("banks") as batch_op:
        batch_op.alter_column("investments_only", server_default=None)

    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.drop_column("initial_invoice_balance")


def downgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.add_column(
            sa.Column(
                "initial_invoice_balance",
                sa.Numeric(12, 2),
                nullable=False,
                server_default="0",
            )
        )
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.alter_column("initial_invoice_balance", server_default=None)

    with op.batch_alter_table("banks") as batch_op:
        batch_op.drop_column("investments_only")
