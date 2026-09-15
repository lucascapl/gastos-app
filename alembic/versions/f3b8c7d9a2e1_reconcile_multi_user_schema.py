"""reconcile multi-user schema

Revision ID: f3b8c7d9a2e1
Revises: 8bdb359b0547
Create Date: 2026-09-14 00:00:00.000000

"""
from typing import Sequence, Union
import os
import secrets

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3b8c7d9a2e1"
down_revision: Union[str, Sequence[str], None] = "8bdb359b0547"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCOPED_NAME_TABLES = {
    "categories": "uq_categories_user_name",
    "payment_methods": "uq_payment_methods_user_name",
    "people": "uq_people_user_name",
}
OWNED_TABLES = (*SCOPED_NAME_TABLES.keys(), "transactions")

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def _inspector():
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _columns(table_name: str) -> dict[str, dict]:
    if not _table_exists(table_name):
        return {}
    return {column["name"]: column for column in _inspector().get_columns(table_name)}


def _column_exists(table_name: str, column_name: str) -> bool:
    return column_name in _columns(table_name)


def _column_is_nullable(table_name: str, column_name: str) -> bool:
    return bool(_columns(table_name)[column_name].get("nullable"))


def _indexes(table_name: str) -> list[dict]:
    if not _table_exists(table_name):
        return []
    return _inspector().get_indexes(table_name)


def _unique_constraints(table_name: str) -> list[dict]:
    if not _table_exists(table_name):
        return []
    return _inspector().get_unique_constraints(table_name)


def _foreign_keys(table_name: str) -> list[dict]:
    if not _table_exists(table_name):
        return []
    return _inspector().get_foreign_keys(table_name)


def _has_index(table_name: str, columns: list[str]) -> bool:
    return any(index.get("column_names") == columns for index in _indexes(table_name))


def _has_unique_on_columns(table_name: str, columns: list[str]) -> bool:
    for constraint in _unique_constraints(table_name):
        if constraint.get("column_names") == columns:
            return True
    for index in _indexes(table_name):
        if index.get("unique") and index.get("column_names") == columns:
            return True
    return False


def _has_foreign_key(table_name: str, columns: list[str], referred_table: str) -> bool:
    for foreign_key in _foreign_keys(table_name):
        if (
            foreign_key.get("constrained_columns") == columns
            and foreign_key.get("referred_table") == referred_table
        ):
            return True
    return False


def _quoted(table_name: str) -> str:
    return op.get_bind().dialect.identifier_preparer.quote(table_name)


def _count_null_user_id(table_name: str) -> int:
    if not _table_exists(table_name) or not _column_exists(table_name, "user_id"):
        return 0
    result = op.get_bind().execute(
        sa.text(f"SELECT COUNT(*) FROM {_quoted(table_name)} WHERE user_id IS NULL")
    )
    return int(result.scalar_one())


def _legacy_password_hash() -> str:
    try:
        import bcrypt
    except Exception as exc:  # pragma: no cover - defensive migration guard
        raise RuntimeError("bcrypt is required to create the legacy migration user") from exc

    password = secrets.token_urlsafe(48).encode("utf-8")
    return bcrypt.hashpw(password, bcrypt.gensalt()).decode("utf-8")


def _ensure_legacy_user() -> int:
    bind = op.get_bind()
    username = os.getenv("ALEMBIC_LEGACY_USERNAME", "legacy_migration_user")
    existing = bind.execute(
        sa.text("SELECT id FROM usuarios WHERE username = :username"),
        {"username": username},
    ).scalar_one_or_none()
    if existing is not None:
        return int(existing)

    bind.execute(
        sa.text(
            "INSERT INTO usuarios (username, password_hash) "
            "VALUES (:username, :password_hash)"
        ),
        {"username": username, "password_hash": _legacy_password_hash()},
    )
    return int(
        bind.execute(
            sa.text("SELECT id FROM usuarios WHERE username = :username"),
            {"username": username},
        ).scalar_one()
    )


def _owner_for_legacy_rows() -> int:
    rows = op.get_bind().execute(sa.text("SELECT id FROM usuarios ORDER BY id")).fetchall()
    if len(rows) == 1:
        return int(rows[0][0])
    return _ensure_legacy_user()


def _ensure_usuarios_table() -> None:
    if not _table_exists("usuarios"):
        op.create_table(
            "usuarios",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("username", sa.String(), nullable=False),
            sa.Column("password_hash", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _has_unique_on_columns("usuarios", ["username"]):
        index_name = "ix_usuarios_username"
        if any(index.get("name") == index_name for index in _indexes("usuarios")):
            index_name = "uq_usuarios_username"
        op.create_index(index_name, "usuarios", ["username"], unique=True)


def _ensure_user_id_columns() -> None:
    for table_name in OWNED_TABLES:
        if _table_exists(table_name) and not _column_exists(table_name, "user_id"):
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))


def _backfill_user_id_columns() -> None:
    tables_with_orphans = [
        table_name for table_name in OWNED_TABLES if _count_null_user_id(table_name) > 0
    ]
    if not tables_with_orphans:
        return

    owner_id = _owner_for_legacy_rows()
    for table_name in tables_with_orphans:
        op.get_bind().execute(
            sa.text(f"UPDATE {_quoted(table_name)} SET user_id = :owner_id WHERE user_id IS NULL"),
            {"owner_id": owner_id},
        )


def _ensure_no_duplicate_scoped_names(table_name: str) -> None:
    rows = op.get_bind().execute(
        sa.text(
            f"SELECT user_id, name, COUNT(*) AS total "
            f"FROM {_quoted(table_name)} "
            "GROUP BY user_id, name "
            "HAVING COUNT(*) > 1 "
            "LIMIT 5"
        )
    ).fetchall()
    if rows:
        raise RuntimeError(
            f"Cannot create scoped unique constraint on {table_name}. "
            "Duplicate (user_id, name) values exist and must be resolved first."
        )


def _drop_unique_indexes_on_name(table_name: str) -> None:
    for index in _indexes(table_name):
        if index.get("unique") and index.get("column_names") == ["name"]:
            name = index.get("name")
            if name and not name.startswith("sqlite_autoindex"):
                op.drop_index(name, table_name=table_name)


def _reconcile_scoped_name_table(table_name: str, scoped_unique_name: str) -> None:
    _ensure_no_duplicate_scoped_names(table_name)

    old_unique_names = []
    for constraint in _unique_constraints(table_name):
        if constraint.get("column_names") == ["name"]:
            old_unique_names.append(constraint.get("name") or f"uq_{table_name}_name")

    needs_nullable_change = _column_is_nullable(table_name, "user_id")
    needs_user_fk = not _has_foreign_key(table_name, ["user_id"], "usuarios")
    needs_scoped_unique = not _has_unique_on_columns(table_name, ["user_id", "name"])

    if old_unique_names or needs_nullable_change or needs_user_fk or needs_scoped_unique:
        with op.batch_alter_table(
            table_name, naming_convention=NAMING_CONVENTION
        ) as batch_op:
            for unique_name in old_unique_names:
                batch_op.drop_constraint(unique_name, type_="unique")
            if needs_nullable_change:
                batch_op.alter_column(
                    "user_id", existing_type=sa.Integer(), nullable=False
                )
            if needs_user_fk:
                batch_op.create_foreign_key(
                    f"fk_{table_name}_user_id_usuarios",
                    "usuarios",
                    ["user_id"],
                    ["id"],
                )
            if needs_scoped_unique:
                batch_op.create_unique_constraint(
                    scoped_unique_name, ["user_id", "name"]
                )

    _drop_unique_indexes_on_name(table_name)
    if not _has_index(table_name, ["user_id"]):
        op.create_index(f"ix_{table_name}_user_id", table_name, ["user_id"])


def _reconcile_transactions_table() -> None:
    needs_nullable_change = _column_is_nullable("transactions", "user_id")
    needs_user_fk = not _has_foreign_key("transactions", ["user_id"], "usuarios")

    if needs_nullable_change or needs_user_fk:
        with op.batch_alter_table(
            "transactions", naming_convention=NAMING_CONVENTION
        ) as batch_op:
            if needs_nullable_change:
                batch_op.alter_column(
                    "user_id", existing_type=sa.Integer(), nullable=False
                )
            if needs_user_fk:
                batch_op.create_foreign_key(
                    "fk_transactions_user_id_usuarios",
                    "usuarios",
                    ["user_id"],
                    ["id"],
                )

    if not _has_index("transactions", ["user_id"]):
        op.create_index("ix_transactions_user_id", "transactions", ["user_id"])


def upgrade() -> None:
    """Reconcile Alembic schema with the current multi-user models."""
    _ensure_usuarios_table()
    _ensure_user_id_columns()
    _backfill_user_id_columns()

    for table_name, scoped_unique_name in SCOPED_NAME_TABLES.items():
        _reconcile_scoped_name_table(table_name, scoped_unique_name)
    _reconcile_transactions_table()


def downgrade() -> None:
    """Downgrade is intentionally blocked to avoid destroying ownership data."""
    raise RuntimeError(
        "Downgrading f3b8c7d9a2e1 would remove multi-user ownership columns, "
        "foreign keys, and possibly the usuarios table. Perform a manual, "
        "audited data migration instead."
    )
