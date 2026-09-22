"""add user profile and banks

Revision ID: c8d1e2f3a4b5
Revises: b7c9d2e4f601
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d1e2f3a4b5"
down_revision: Union[str, Sequence[str], None] = "b7c9d2e4f601"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.add_column(sa.Column("initial_balance", sa.Numeric(12, 2), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("initial_invoice_balance", sa.Numeric(12, 2), nullable=False, server_default="0"))

    op.create_table(
        "banks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("closing_day", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_banks_user_name"),
    )
    op.create_index("ix_banks_user_id", "banks", ["user_id"])

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT DISTINCT user_id, bank "
            "FROM transactions "
            "WHERE bank IS NOT NULL AND TRIM(bank) <> ''"
        )
    ).fetchall()
    for user_id, bank in rows:
        bind.execute(
            sa.text(
                "INSERT INTO banks (user_id, name, closing_day) "
                "VALUES (:user_id, :name, NULL) "
                "ON CONFLICT (user_id, name) DO NOTHING"
            ),
            {"user_id": user_id, "name": bank},
        )

    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.alter_column("initial_balance", server_default=None)
        batch_op.alter_column("initial_invoice_balance", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_banks_user_id", table_name="banks")
    op.drop_table("banks")
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.drop_column("initial_invoice_balance")
        batch_op.drop_column("initial_balance")
