from flask_smorest import Blueprint, abort
from flask import request
from datetime import date
from ..db import SessionLocal
from ..models import Transaction, Category, PaymentMethod, Person, TxType
from typing import Optional
from ..settings import OWNER

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

@blp.route("/transactions", methods=["GET"])
def list_transactions():
    s = SessionLocal()
    q = s.query(Transaction).order_by(Transaction.day.desc(), Transaction.id.desc())
    return [{
        "id": t.id,
        "value": float(t.value),
        "event": t.event,
        "day": t.day.isoformat(),
        "category": t.category.name if t.category else None,
        "payment": t.payment_method.name if t.payment_method else None,
        "person": t.person.name if t.person else None,
    } for t in q.all()]

@blp.route("/transactions", methods=["POST"])
def create_transaction():
    data = request.get_json()
    s = SessionLocal()

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

    # ----- resolve FKs por nome (criando se necessário) -----
    def get_or_create(model, name):
        if not name:
            return None
        obj = s.query(model).filter_by(name=name).first()
        if not obj:
            obj = model(name=name)
            s.add(obj); s.flush()
        return obj

    cat = get_or_create(Category, _norm(data.get("category")))
    pay = get_or_create(PaymentMethod, _norm_payment(data.get("payment")))

    person_name = _norm(data.get("person")) or OWNER
    per = get_or_create(Person, person_name)

    t = Transaction(
        value=value,
        event=_norm(data["event"]),
        day=date.fromisoformat(data["day"]),
        category=cat, payment_method=pay, person=per,
        tx_type=tx_type
    )
    s.add(t); s.commit()
    out = {"id": t.id}
    s.close()
    return out, 201

@blp.route("/transactions/options", methods=["GET"])
def list_options():
    s = SessionLocal()
    cats = [c.name for c in s.query(Category).order_by(Category.name).all()]
    pays = [p.name for p in s.query(PaymentMethod).order_by(PaymentMethod.name).all()]
    people = [p.name for p in s.query(Person).order_by(Person.name).all()]
    s.close()
    return {
        "categories": cats,
        "payment_methods": pays,
        "people": people,
    }