from flask_smorest import Blueprint, abort
from flask import request
from flask_jwt_extended import jwt_required, current_user
from datetime import date
from ..db import SessionLocal
from ..models import Transaction, Category, PaymentMethod, Person, TxType
from typing import Optional

blp = Blueprint("transactions", __name__, description="Transações")

def _norm(s):
    return (s or "").strip()

def _norm_payment(name: Optional[str]):
    if not name:
        return None
    n = _norm(name).lower()
    if n in ("crédito", "credito", "cartão", "cartao", "cc"):
        return "Credito"
    if n in ("débito", "debito", "dbt"):
        return "Debito"
    return name

def _get_or_create_user_scoped(s, model, name: Optional[str]):
    """Busca/cria registros (Category/PaymentMethod/Person) por nome, escopado no usuário logado."""
    if not name:
        return None
    obj = (
        s.query(model)
        .filter_by(user_id=current_user.id, name=name)
        .first()
    )
    if not obj:
        obj = model(user_id=current_user.id, name=name)
        s.add(obj)
        s.flush()
    return obj

@blp.route("/transactions", methods=["GET"])
@jwt_required()
def list_transactions():
    s = SessionLocal()
    try:
        q = (
            s.query(Transaction)
            .filter(Transaction.user_id == current_user.id)
            .order_by(Transaction.day.desc(), Transaction.id.desc())
        )
        return [{
            "id": t.id,
            "value": float(t.value),
            "event": t.event,
            "day": t.day.isoformat(),
            "category": t.category.name if t.category else None,
            "payment": t.payment_method.name if t.payment_method else None,
            "person": t.person.name if t.person else None,
            "tx_type": t.tx_type.value if t.tx_type else "normal",
        } for t in q.all()]
    finally:
        s.close()

@blp.route("/transactions", methods=["POST"])
@jwt_required()
def create_transaction():
    data = request.get_json() or {}
    s = SessionLocal()

    try:
        # ----- validações de tipo -----
        tx_type_str = data.get("tx_type", "normal")
        try:
            tx_type = TxType(tx_type_str)
        except Exception:
            abort(400, message="tx_type inválido. Use: 'normal', 'reembolso_credito', 'reembolso_debito'.")

        try:
            value = float(data["value"])
        except Exception:
            abort(400, message="Campo 'value' é obrigatório e deve ser número.")

        if tx_type == TxType.reembolso_credito and value <= 0:
            abort(400, message="reembolso_credito deve ser positivo.")
        if tx_type == TxType.reembolso_debito and value <= 0:
            abort(400, message="reembolso_debito deve ser positivo.")

        # opcional: exigir person em reembolsos
        if tx_type in (TxType.reembolso_credito, TxType.reembolso_debito) and not _norm(data.get("person")):
            abort(400, message="Reembolsos exigem 'person' definido.")

        # ----- resolve FKs por nome (criando se necessário), SEMPRE por usuário -----
        cat = _get_or_create_user_scoped(s, Category, _norm(data.get("category")))
        pay = _get_or_create_user_scoped(s, PaymentMethod, _norm_payment(data.get("payment")))

        # se não mandar person, assume que é o próprio usuário (owner)
        person_name = _norm(data.get("person")) or current_user.username
        per = _get_or_create_user_scoped(s, Person, person_name)

        # campos obrigatórios
        if not _norm(data.get("event")):
            abort(400, message="Campo 'event' é obrigatório.")
        if not _norm(data.get("day")):
            abort(400, message="Campo 'day' é obrigatório (YYYY-MM-DD).")

        t = Transaction(
            user_id=current_user.id,
            value=value,
            event=_norm(data["event"]),
            day=date.fromisoformat(data["day"]),
            category=cat,
            payment_method=pay,
            person=per,
            tx_type=tx_type,
        )
        s.add(t)
        s.commit()
        return {"id": t.id}, 201
    finally:
        s.close()

@blp.route("/transactions/<int:tx_id>", methods=["PUT", "PATCH"])
@jwt_required()
def update_transaction(tx_id):
    data = request.get_json() or {}
    s = SessionLocal()
    try:
        t = (
            s.query(Transaction)
            .filter(Transaction.id == tx_id, Transaction.user_id == current_user.id)
            .first()
        )
        if not t:
            abort(404, message="Transação não encontrada.")

        # campos simples
        if "value" in data:
            t.value = float(data["value"])
        if "event" in data:
            t.event = _norm(data["event"])
        if "day" in data:
            t.day = date.fromisoformat(data["day"])
        if "tx_type" in data:
            try:
                t.tx_type = TxType(data["tx_type"])
            except Exception:
                abort(400, message="tx_type inválido. Use: 'normal', 'reembolso_credito', 'reembolso_debito'.")

        # relacionamentos por nome (escopados no usuário)
        if "category" in data:
            t.category = _get_or_create_user_scoped(s, Category, _norm(data["category"]))
        if "payment" in data:
            t.payment_method = _get_or_create_user_scoped(s, PaymentMethod, _norm_payment(data["payment"]))
        if "person" in data:
            person_name = _norm(data["person"]) or current_user.username
            t.person = _get_or_create_user_scoped(s, Person, person_name)

        s.commit()

        return {
            "id": t.id,
            "value": float(t.value),
            "event": t.event,
            "day": t.day.isoformat(),
            "category": t.category.name if t.category else None,
            "payment": t.payment_method.name if t.payment_method else None,
            "person": t.person.name if t.person else None,
            "tx_type": t.tx_type.value if t.tx_type else "normal",
        }, 200
    finally:
        s.close()

@blp.route("/transactions/options", methods=["GET"])
@jwt_required()
def list_options():
    s = SessionLocal()
    try:
        cats = [c.name for c in s.query(Category).filter_by(user_id=current_user.id).order_by(Category.name).all()]
        pays = [p.name for p in s.query(PaymentMethod).filter_by(user_id=current_user.id).order_by(PaymentMethod.name).all()]
        people = [p.name for p in s.query(Person).filter_by(user_id=current_user.id).order_by(Person.name).all()]
        return {
            "categories": cats,
            "payment_methods": pays,
            "people": people,
        }
    finally:
        s.close()
