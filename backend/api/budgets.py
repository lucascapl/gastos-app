from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from flask import request
from flask_jwt_extended import current_user, jwt_required
from flask_smorest import Blueprint, abort
from sqlalchemy import extract, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from ..db import SessionLocal
from ..models import Category, MonthlyBudget, Person, Transaction, TxType


blp = Blueprint("budgets", __name__, description="Orcamentos mensais por categoria")

MAX_BUDGET_AMOUNT = Decimal("9999999999.99")


def _norm(value):
    return str(value or "").strip().lower()


def _parse_integer(value, field_name, minimum, maximum):
    if isinstance(value, bool):
        abort(400, message=f"Campo '{field_name}' deve ser um numero inteiro.")
    if isinstance(value, float) and not value.is_integer():
        abort(400, message=f"Campo '{field_name}' deve ser um numero inteiro.")
    if isinstance(value, str) and not value.strip().lstrip("+-").isdigit():
        abort(400, message=f"Campo '{field_name}' deve ser um numero inteiro.")
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        abort(400, message=f"Campo '{field_name}' deve ser um numero inteiro.")
    if parsed < minimum or parsed > maximum:
        abort(400, message=f"Campo '{field_name}' deve estar entre {minimum} e {maximum}.")
    return parsed


def _parse_amount(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        abort(400, message="Campo 'amount' deve ser um valor monetario valido.")
    if not amount.is_finite() or amount <= 0:
        abort(400, message="Campo 'amount' deve ser maior que zero.")
    if amount.as_tuple().exponent < -2:
        abort(400, message="Campo 'amount' deve ter no maximo duas casas decimais.")
    if amount > MAX_BUDGET_AMOUNT:
        abort(400, message="Campo 'amount' excede o limite permitido.")
    return amount


def _parse_period(source, require_year=True):
    year_raw = source.get("year")
    month_raw = source.get("month")
    if year_raw in (None, ""):
        if require_year:
            abort(400, message="Campo 'year' e obrigatorio.")
        if month_raw not in (None, ""):
            abort(400, message="Campo 'month' exige o campo 'year'.")
        return None, None

    year = _parse_integer(year_raw, "year", 1, 9999)
    month = None
    if month_raw not in (None, ""):
        month = _parse_integer(month_raw, "month", 1, 12)
    return year, month


def _owned_category(session, category_id):
    category = (
        session.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not category:
        abort(404, message="Categoria nao encontrada.")
    return category


def _serialize_budget(budget):
    return {
        "id": budget.id,
        "category": {"id": budget.category.id, "name": budget.category.name},
        "year": budget.year,
        "month": budget.month,
        "amount": float(budget.amount),
        "created_at": budget.created_at.isoformat(),
        "updated_at": budget.updated_at.isoformat(),
    }


def _serialize_summary(budget, actual):
    planned = Decimal(budget.amount)
    actual = Decimal(actual or 0).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    remaining = planned - actual
    usage_percent = (
        (actual / planned * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if planned else Decimal("0")
    )
    return {
        **_serialize_budget(budget),
        "planned": float(planned),
        "actual": float(actual),
        "remaining": float(remaining),
        "usage_percent": float(usage_percent),
        "over_budget": actual > planned,
    }


def _budget_query(session, year, month=None):
    query = (
        session.query(MonthlyBudget)
        .join(MonthlyBudget.category)
        .options(joinedload(MonthlyBudget.category))
        .filter(MonthlyBudget.user_id == current_user.id, MonthlyBudget.year == year)
    )
    if month is not None:
        query = query.filter(MonthlyBudget.month == month)
    return query.order_by(MonthlyBudget.month, Category.name, MonthlyBudget.id)


@blp.route("/budgets", methods=["GET"])
@jwt_required()
def list_budgets():
    year, month = _parse_period(request.args)
    session = SessionLocal()
    try:
        budgets = _budget_query(session, year, month).all()
        return {"items": [_serialize_budget(budget) for budget in budgets]}
    finally:
        session.close()


@blp.route("/budgets", methods=["POST"])
@jwt_required()
def create_budget():
    data = request.get_json() or {}
    year, month = _parse_period(data)
    if month is None:
        abort(400, message="Campo 'month' e obrigatorio.")
    category_id = _parse_integer(data.get("category_id"), "category_id", 1, 2_147_483_647)
    amount = _parse_amount(data.get("amount"))

    session = SessionLocal()
    try:
        category = _owned_category(session, category_id)
        budget = MonthlyBudget(
            user_id=current_user.id,
            category_id=category.id,
            year=year,
            month=month,
            amount=amount,
        )
        session.add(budget)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            abort(409, message="Ja existe um orcamento para esta categoria e periodo.")
        session.refresh(budget)
        return _serialize_budget(budget), 201
    finally:
        session.close()


@blp.route("/budgets/<int:budget_id>", methods=["PATCH"])
@jwt_required()
def update_budget(budget_id):
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        budget = (
            session.query(MonthlyBudget)
            .filter(MonthlyBudget.id == budget_id, MonthlyBudget.user_id == current_user.id)
            .first()
        )
        if not budget:
            abort(404, message="Orcamento nao encontrado.")

        if "amount" in data:
            budget.amount = _parse_amount(data["amount"])
        if "category_id" in data:
            category_id = _parse_integer(data["category_id"], "category_id", 1, 2_147_483_647)
            budget.category = _owned_category(session, category_id)

        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            abort(409, message="Ja existe um orcamento para esta categoria e periodo.")
        session.refresh(budget)
        return _serialize_budget(budget)
    finally:
        session.close()


@blp.route("/budgets/<int:budget_id>", methods=["DELETE"])
@jwt_required()
def delete_budget(budget_id):
    session = SessionLocal()
    try:
        budget = (
            session.query(MonthlyBudget)
            .filter(MonthlyBudget.id == budget_id, MonthlyBudget.user_id == current_user.id)
            .first()
        )
        if not budget:
            abort(404, message="Orcamento nao encontrado.")
        session.delete(budget)
        session.commit()
        return {"id": budget_id, "deleted": True}
    finally:
        session.close()


@blp.route("/budgets/summary", methods=["GET"])
@jwt_required()
def budget_summary():
    year, month = _parse_period(request.args)
    session = SessionLocal()
    try:
        budgets = _budget_query(session, year, month).all()
        if not budgets:
            return {"items": []}

        category_ids = [budget.category_id for budget in budgets]
        actual_query = (
            session.query(
                Transaction.category_id,
                extract("month", Transaction.day).label("month"),
                -func.sum(Transaction.value),
            )
            .join(Person, Transaction.person_id == Person.id)
            .filter(Transaction.user_id == current_user.id)
            .filter(Transaction.category_id.in_(category_ids))
            .filter(Transaction.is_projected.is_(False))
            .filter(Transaction.is_deleted.is_(False))
            .filter(Transaction.tx_type == TxType.normal)
            .filter(Transaction.value < 0)
            .filter(Person.user_id == current_user.id)
            .filter(func.lower(func.trim(Person.name)) == _norm(current_user.username))
            .filter(extract("year", Transaction.day) == year)
        )
        if month is not None:
            actual_query = actual_query.filter(extract("month", Transaction.day) == month)
        actual_by_period = {
            (category_id, int(transaction_month)): actual
            for category_id, transaction_month, actual in actual_query.group_by(
                Transaction.category_id,
                extract("month", Transaction.day),
            ).all()
        }
        return {
            "items": [
                _serialize_summary(
                    budget,
                    actual_by_period.get((budget.category_id, budget.month)),
                )
                for budget in budgets
            ]
        }
    finally:
        session.close()
