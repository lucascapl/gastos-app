from ..db import SessionLocal
from ..models import Transaction, Category, PaymentMethod, Person
from flask_smorest import Blueprint
from flask import request
from datetime import date

blp = Blueprint("transactions", __name__, description="Transações")

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
    # helpers para resolver FKs por nome:
    def get_or_create(model, name):
        obj = s.query(model).filter_by(name=name).first()
        if not obj:
            obj = model(name=name); s.add(obj); s.flush()
        return obj
    cat = get_or_create(Category, data.get("category")) if data.get("category") else None
    pay = get_or_create(PaymentMethod, data.get("payment")) if data.get("payment") else None
    per = get_or_create(Person, data.get("person")) if data.get("person") else None

    t = Transaction(
        value=data["value"],
        event=data["event"],
        day=date.fromisoformat(data["day"]),
        category=cat, payment_method=pay, person=per
    )
    s.add(t); s.commit()
    return {"id": t.id}, 201
