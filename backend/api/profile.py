from flask import request
from flask_jwt_extended import jwt_required, current_user
from flask_smorest import Blueprint, abort

from ..db import SessionLocal
from ..models import Bank, Transaction, User


blp = Blueprint("profile", __name__, description="Perfil do usuario")


def _to_float(value):
    try:
        return float(value or 0)
    except Exception:
        abort(400, message="Valor numerico invalido.")


def _serialize_bank(s, bank):
    usage_count = (
        s.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.is_deleted.is_(False))
        .filter(Transaction.bank == bank.name)
        .count()
    )
    return {
        "id": bank.id,
        "name": bank.name,
        "closing_day": bank.closing_day,
        "investments_only": bool(bank.investments_only),
        "usage_count": usage_count,
    }


def _serialize_profile(s, user):
    banks = (
        s.query(Bank)
        .filter(Bank.user_id == user.id)
        .order_by(Bank.name)
        .all()
    )
    return {
        "username": user.username,
        "initial_balance": float(user.initial_balance or 0),
        "banks": [_serialize_bank(s, bank) for bank in banks],
    }


@blp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    s = SessionLocal()
    try:
        user = s.query(User).filter(User.id == current_user.id).first()
        return _serialize_profile(s, user)
    finally:
        s.close()


@blp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_profile():
    data = request.get_json() or {}
    s = SessionLocal()
    try:
        user = s.query(User).filter(User.id == current_user.id).first()
        if "initial_balance" in data:
            user.initial_balance = _to_float(data.get("initial_balance"))
        s.commit()
        return _serialize_profile(s, user)
    finally:
        s.close()
