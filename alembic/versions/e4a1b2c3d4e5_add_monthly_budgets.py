"""add monthly budgets

Revision ID: e4a1b2c3d4e5
Revises: d9e0f1a2b3c4
Create Date: 2026-10-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "d9e0f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "monthly_budgets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_monthly_budgets_amount"),
        sa.CheckConstraint("month >= 1 AND month <= 12", name="ck_monthly_budgets_month"),
        sa.CheckConstraint("year >= 1 AND year <= 9999", name="ck_monthly_budgets_year"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "category_id", "year", "month",
            name="uq_monthly_budgets_user_category_period",
        ),
    )
    op.create_index(
        "ix_monthly_budgets_user_year_month",
        "monthly_budgets",
        ["user_id", "year", "month"],
    )


def downgrade() -> None:
    op.drop_index("ix_monthly_budgets_user_year_month", table_name="monthly_budgets")
    op.drop_table("monthly_budgets")
