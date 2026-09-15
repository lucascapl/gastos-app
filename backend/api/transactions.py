from flask_smorest import Blueprint, abort
from flask import request
from flask_jwt_extended import jwt_required, current_user
from datetime import date, datetime
from ..db import SessionLocal
from ..models import Transaction, Category, PaymentMethod, Person, TxType
from typing import Optional

REFERENCE_MODELS = {
    "categories": (Category, Transaction.category_id),
    "payment_methods": (PaymentMethod, Transaction.payment_method_id),
    "people": (Person, Transaction.person_id),
}

blp = Blueprint("transactions", __name__, description="Transações")

def _norm(s):
    return (s or "").strip()

def _serialize_transaction(t: Transaction):
    return {
        "id": t.id,
        "value": float(t.value),
        "event": t.event,
        "day": t.day.isoformat(),
        "bank": t.bank,
        "category": t.category.name if t.category else None,
        "payment": t.payment_method.name if t.payment_method else None,
        "person": t.person.name if t.person else None,
        "tx_type": t.tx_type.value if t.tx_type else "normal",
    }

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

def _reference_model(kind: str):
    if kind not in REFERENCE_MODELS:
        abort(404, message="Tipo de cadastro nao encontrado.")
    return REFERENCE_MODELS[kind]

def _normalize_reference_name(kind: str, name: Optional[str]):
    normalized = _norm_payment(name) if kind == "payment_methods" else _norm(name)
    if not normalized:
        abort(400, message="Nome e obrigatorio.")
    return normalized

def _serialize_reference_item(s, model, fk_column, item):
    usage_count = (
        s.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.is_deleted.is_(False))
        .filter(fk_column == item.id)
        .count()
    )
    return {"id": item.id, "name": item.name, "usage_count": usage_count}

@blp.route("/transactions", methods=["GET"])
@jwt_required()
def list_transactions():
    s = SessionLocal()
    try:
        q = (
            s.query(Transaction)
            .filter(Transaction.user_id == current_user.id)
            .filter(Transaction.is_deleted.is_(False))
            .order_by(Transaction.day.desc(), Transaction.id.desc())
        )
        return [_serialize_transaction(t) for t in q.all()]
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
            bank=_norm(data.get("bank")) or None,
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
            .filter(Transaction.is_deleted.is_(False))
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
        if "bank" in data:
            t.bank = _norm(data["bank"]) or None
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

        return _serialize_transaction(t), 200
    finally:
        s.close()

@blp.route("/transactions/<int:tx_id>", methods=["DELETE"])
@jwt_required()
def delete_transaction(tx_id):
    s = SessionLocal()
    try:
        t = (
            s.query(Transaction)
            .filter(Transaction.id == tx_id, Transaction.user_id == current_user.id)
            .filter(Transaction.is_deleted.is_(False))
            .first()
        )
        if not t:
            abort(404, message="TransaÃ§Ã£o nÃ£o encontrada.")

        t.is_deleted = True
        t.deleted_at = datetime.utcnow()
        s.commit()
        return {"id": t.id, "deleted": True}, 200
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
        banks = [
            row[0]
            for row in (
                s.query(Transaction.bank)
                .filter(Transaction.user_id == current_user.id)
                .filter(Transaction.is_deleted.is_(False))
                .filter(Transaction.bank.isnot(None))
                .distinct()
                .order_by(Transaction.bank)
                .all()
            )
            if row[0]
        ]
        return {
            "categories": cats,
            "payment_methods": pays,
            "people": people,
            "banks": banks,
        }
    finally:
        s.close()

@blp.route("/transactions/reference-data", methods=["GET"])
@jwt_required()
def list_reference_data():
    s = SessionLocal()
    try:
        result = {}
        for kind, (model, fk_column) in REFERENCE_MODELS.items():
            items = (
                s.query(model)
                .filter(model.user_id == current_user.id)
                .order_by(model.name)
                .all()
            )
            result[kind] = [
                _serialize_reference_item(s, model, fk_column, item)
                for item in items
            ]
        return result
    finally:
        s.close()

@blp.route("/transactions/reference-data/<string:kind>", methods=["POST"])
@jwt_required()
def create_reference_item(kind):
    data = request.get_json() or {}
    model, fk_column = _reference_model(kind)
    name = _normalize_reference_name(kind, data.get("name"))

    s = SessionLocal()
    try:
        existing = (
            s.query(model)
            .filter(model.user_id == current_user.id, model.name == name)
            .first()
        )
        if existing:
            abort(409, message="Ja existe um cadastro com esse nome.")

        item = model(user_id=current_user.id, name=name)
        s.add(item)
        s.commit()
        s.refresh(item)
        return _serialize_reference_item(s, model, fk_column, item), 201
    finally:
        s.close()

@blp.route("/transactions/reference-data/<string:kind>/<int:item_id>", methods=["PATCH"])
@jwt_required()
def update_reference_item(kind, item_id):
    data = request.get_json() or {}
    model, fk_column = _reference_model(kind)
    name = _normalize_reference_name(kind, data.get("name"))

    s = SessionLocal()
    try:
        item = (
            s.query(model)
            .filter(model.id == item_id, model.user_id == current_user.id)
            .first()
        )
        if not item:
            abort(404, message="Cadastro nao encontrado.")

        duplicate = (
            s.query(model)
            .filter(model.user_id == current_user.id, model.name == name, model.id != item_id)
            .first()
        )
        if duplicate:
            abort(409, message="Ja existe um cadastro com esse nome.")

        item.name = name
        s.commit()
        return _serialize_reference_item(s, model, fk_column, item), 200
    finally:
        s.close()

@blp.route("/transactions/reference-data/<string:kind>/<int:item_id>", methods=["DELETE"])
@jwt_required()
def delete_reference_item(kind, item_id):
    model, fk_column = _reference_model(kind)

    s = SessionLocal()
    try:
        item = (
            s.query(model)
            .filter(model.id == item_id, model.user_id == current_user.id)
            .first()
        )
        if not item:
            abort(404, message="Cadastro nao encontrado.")

        usage_count = (
            s.query(Transaction)
            .filter(Transaction.user_id == current_user.id)
            .filter(Transaction.is_deleted.is_(False))
            .filter(fk_column == item.id)
            .count()
        )
        if usage_count:
            abort(409, message="Cadastro em uso por transacoes.")

        (
            s.query(Transaction)
            .filter(Transaction.user_id == current_user.id)
            .filter(Transaction.is_deleted.is_(True))
            .filter(fk_column == item.id)
            .update({fk_column: None}, synchronize_session=False)
        )
        s.delete(item)
        s.commit()
        return {"id": item_id, "deleted": True}, 200
    finally:
        s.close()
