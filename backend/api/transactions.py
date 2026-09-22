from flask_smorest import Blueprint, abort
from flask import request
from flask_jwt_extended import jwt_required, current_user
from datetime import date, datetime
from calendar import monthrange
from ..db import SessionLocal
from ..models import Transaction, Category, PaymentMethod, Person, Bank, TxType
from typing import Optional

REFERENCE_MODELS = {
    "categories": (Category, Transaction.category_id),
    "payment_methods": (PaymentMethod, Transaction.payment_method_id),
    "people": (Person, Transaction.person_id),
    "banks": (Bank, None),
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
        "is_projected": bool(t.is_projected),
        "category": t.category.name if t.category else None,
        "payment": t.payment_method.name if t.payment_method else None,
        "person": t.person.name if t.person else None,
        "tx_type": t.tx_type.value if t.tx_type else "normal",
    }

def _parse_bool(value, default: bool = False) -> bool:
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    normalized = _norm(str(value)).lower()
    if normalized in ("1", "true", "sim", "yes", "projetada", "projected"):
        return True
    if normalized in ("0", "false", "nao", "não", "no", "realizada", "realized"):
        return False
    abort(400, message="Campo 'is_projected' deve ser booleano.")

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

def _get_or_create_bank(s, name: Optional[str]):
    bank_name = _norm(name)
    if not bank_name:
        return None
    obj = (
        s.query(Bank)
        .filter_by(user_id=current_user.id, name=bank_name)
        .first()
    )
    if not obj:
        obj = Bank(user_id=current_user.id, name=bank_name)
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
    if model is Bank:
        usage_count = (
            s.query(Transaction)
            .filter(Transaction.user_id == current_user.id)
            .filter(Transaction.is_deleted.is_(False))
            .filter(Transaction.bank == item.name)
            .count()
        )
        return {
            "id": item.id,
            "name": item.name,
            "closing_day": item.closing_day,
            "investments_only": bool(item.investments_only),
            "usage_count": usage_count,
        }

    usage_count = (
        s.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .filter(Transaction.is_deleted.is_(False))
        .filter(fk_column == item.id)
        .count()
    )
    return {"id": item.id, "name": item.name, "usage_count": usage_count}

def _add_months(base_day: date, months: int) -> date:
    month_index = base_day.month - 1 + months
    year = base_day.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base_day.day, monthrange(year, month)[1])
    return date(year, month, day)

def _parse_positive_int(value, field_name: str, default: int = 1, maximum: int = 120) -> int:
    if value in (None, ""):
        return default
    try:
        parsed = int(value)
    except Exception:
        abort(400, message=f"Campo '{field_name}' deve ser um numero inteiro.")
    if parsed < 1 or parsed > maximum:
        abort(400, message=f"Campo '{field_name}' deve estar entre 1 e {maximum}.")
    return parsed

def _build_occurrences(data, start_day: date):
    mode = data.get("automation_mode") or data.get("repeat_mode") or "single"
    if mode not in ("single", "installments", "recurring"):
        abort(400, message="automation_mode invalido. Use: 'single', 'installments' ou 'recurring'.")

    count = _parse_positive_int(data.get("repeat_count"), "repeat_count")
    until_raw = _norm(data.get("repeat_until"))
    until_day = None
    if until_raw:
        try:
            until_day = date.fromisoformat(until_raw)
        except Exception:
            abort(400, message="Campo 'repeat_until' deve estar no formato YYYY-MM-DD.")
        if until_day < start_day:
            abort(400, message="Campo 'repeat_until' deve ser maior ou igual ao campo 'day'.")

    if mode == "single":
        count = 1
    elif until_day:
        generated_count = 0
        while _add_months(start_day, generated_count) <= until_day:
            generated_count += 1
            if generated_count > 120:
                abort(400, message="A automacao pode gerar no maximo 120 repeticoes.")
        count = generated_count

    occurrences = []
    for index in range(count):
        event = _norm(data["event"])
        if mode == "installments":
            event = f"{event} {index + 1}/{count}"
        occurrences.append({
            "event": event,
            "day": _add_months(start_day, index),
        })
    return occurrences

def _build_splits(data, total_value: float):
    raw_splits = data.get("splits") or []
    if not raw_splits:
        person_name = _norm(data.get("person")) or current_user.username
        return [{"person": person_name, "value": round(total_value, 2)}]

    cleaned = []
    percent_total = 0.0
    explicit_value_total = 0.0
    has_percent = False
    has_explicit_value = False
    for item in raw_splits:
        person_name = _norm(item.get("person")) or current_user.username
        if "value" in item and item.get("value") not in (None, ""):
            try:
                share_value = abs(float(item["value"]))
            except Exception:
                abort(400, message="Valor da divisao deve ser numerico.")
            explicit_value_total += share_value
            has_explicit_value = True
        else:
            try:
                percent = float(item.get("percent"))
            except Exception:
                abort(400, message="Percentual da divisao deve ser numerico.")
            if percent <= 0:
                abort(400, message="Percentual da divisao deve ser maior que zero.")
            share_value = abs(total_value) * percent / 100
            percent_total += percent
            has_percent = True
        cleaned.append({"person": person_name, "abs_value": share_value})

    if not cleaned:
        abort(400, message="Informe ao menos uma pessoa na divisao.")
    if has_percent and has_explicit_value:
        abort(400, message="Use apenas percentual ou apenas valor na divisao.")
    if has_percent and round(percent_total, 2) != 100:
        abort(400, message="Os percentuais da divisao devem somar 100.")
    if has_explicit_value and round(explicit_value_total, 2) != round(abs(total_value), 2):
        abort(400, message="Os valores da divisao devem somar o valor total.")

    total_abs = abs(total_value)
    sign = -1 if total_value < 0 else 1
    rounded_sum = 0.0
    result = []
    for index, item in enumerate(cleaned):
        if index == len(cleaned) - 1:
            abs_value = round(total_abs - rounded_sum, 2)
        else:
            abs_value = round(item["abs_value"], 2)
            rounded_sum = round(rounded_sum + abs_value, 2)
        result.append({"person": item["person"], "value": round(abs_value * sign, 2)})

    if round(sum(abs(item["value"]) for item in result), 2) != round(total_abs, 2):
        abort(400, message="A soma da divisao deve fechar com o valor total.")
    return result

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
        bank_name = _norm(data.get("bank")) or None
        _get_or_create_bank(s, bank_name)

        if not _norm(data.get("event")):
            abort(400, message="Campo 'event' Ã© obrigatÃ³rio.")
        if not _norm(data.get("day")):
            abort(400, message="Campo 'day' Ã© obrigatÃ³rio (YYYY-MM-DD).")

        # se não mandar person, assume que é o próprio usuário (owner)
        try:
            start_day = date.fromisoformat(data["day"])
        except Exception:
            abort(400, message="Campo 'day' deve estar no formato YYYY-MM-DD.")

        occurrences = _build_occurrences(data, start_day)
        splits = _build_splits(data, value)
        is_projected = _parse_bool(data.get("is_projected"))
        created = []

        # campos obrigatórios
        if not _norm(data.get("event")):
            abort(400, message="Campo 'event' é obrigatório.")
        if not _norm(data.get("day")):
            abort(400, message="Campo 'day' é obrigatório (YYYY-MM-DD).")

        for occurrence in occurrences:
            for split in splits:
                per = _get_or_create_user_scoped(s, Person, split["person"])
                t = Transaction(
                    user_id=current_user.id,
                    value=split["value"],
                    event=occurrence["event"],
                    day=occurrence["day"],
                    bank=bank_name,
                    is_projected=is_projected,
                    category=cat,
                    payment_method=pay,
                    person=per,
                    tx_type=tx_type,
                )
                s.add(t)
                created.append(t)
        s.commit()
        return {"ids": [t.id for t in created], "created": len(created)}, 201
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
            bank_name = _norm(data["bank"]) or None
            _get_or_create_bank(s, bank_name)
            t.bank = bank_name
        if "is_projected" in data:
            t.is_projected = _parse_bool(data["is_projected"])
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
            bank.name
            for bank in s.query(Bank).filter_by(user_id=current_user.id).order_by(Bank.name).all()
        ]
        transaction_banks = [
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
        banks = sorted(set([*banks, *transaction_banks]))
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
        if model is Bank and "closing_day" in data:
            item.closing_day = _parse_positive_int(data.get("closing_day"), "closing_day", default=0, maximum=31) or None
        if model is Bank and "investments_only" in data:
            item.investments_only = _parse_bool(data.get("investments_only"))
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

        old_name = item.name
        item.name = name
        if model is Bank and "closing_day" in data:
            closing_day = data.get("closing_day")
            if closing_day in (None, ""):
                item.closing_day = None
            else:
                parsed = _parse_positive_int(closing_day, "closing_day", maximum=31)
                item.closing_day = parsed
        if model is Bank and "investments_only" in data:
            item.investments_only = _parse_bool(data.get("investments_only"))
        if model is Bank and old_name != name:
            (
                s.query(Transaction)
                .filter(Transaction.user_id == current_user.id)
                .filter(Transaction.bank == old_name)
                .update({Transaction.bank: name}, synchronize_session=False)
            )
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

        if model is Bank:
            usage_count = (
                s.query(Transaction)
                .filter(Transaction.user_id == current_user.id)
                .filter(Transaction.is_deleted.is_(False))
                .filter(Transaction.bank == item.name)
                .count()
            )
        else:
            usage_count = (
                s.query(Transaction)
                .filter(Transaction.user_id == current_user.id)
                .filter(Transaction.is_deleted.is_(False))
                .filter(fk_column == item.id)
                .count()
            )
        if usage_count:
            abort(409, message="Cadastro em uso por transacoes.")

        if model is not Bank:
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
