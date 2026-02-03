from flask_smorest import Blueprint
from flask_jwt_extended import jwt_required, current_user
from ..db import SessionLocal
from ..models import Transaction, TxType
from sqlalchemy.orm import joinedload

blp = Blueprint("balance", __name__, description="Balanço e faturas")

CREDITO = "credito"
DEBITO = "debito"

def _norm(s): 
    return (s or "").strip().lower()

@blp.route("/balance", methods=["GET"])
@jwt_required()
def get_balance():
    s = SessionLocal()
    try:
        txs = (
            s.query(Transaction)
            .filter(Transaction.user_id == current_user.id)
            .options(joinedload(Transaction.payment_method), joinedload(Transaction.person))
            .all()
        )

        saldo_total = 0.0
        faturas = {}   # { pessoa: total }
        me_devem = {}  # { pessoa: total }

        for t in txs:
            val = float(t.value)
            person = (t.person.name if t.person else None) or "—"
            pay = _norm(t.payment_method.name if t.payment_method else "")
            is_owner = _norm(person) == _norm(current_user.username)

            # reembolsos
            if t.tx_type == TxType.reembolso_credito:
                # não altera saldo; abate/compensa fatura
                faturas[person] = round(faturas.get(person, 0.0) + val, 2)
                continue
            if t.tx_type == TxType.reembolso_debito:
                # entra dinheiro; abate/compensa "me devem"
                saldo_total += val
                me_devem[person] = round(me_devem.get(person, 0.0) + val, 2)
                continue

            # transações normais
            if is_owner:
                saldo_total += val
            else:
                if pay == CREDITO:
                    faturas[person] = round(faturas.get(person, 0.0) + val, 2)
                elif pay == DEBITO:
                    saldo_total += val
                    me_devem[person] = round(me_devem.get(person, 0.0) + val, 2)
                else:
                    # outros meios: contam no saldo; se gasto (neg.), também "me devem"
                    saldo_total += val
                    if val < 0:
                        me_devem[person] = round(me_devem.get(person, 0.0) + val, 2)

        # remove zeros
        faturas = {p: round(v, 2) for p, v in faturas.items() if round(v, 2) != 0}
        me_devem = {p: round(v, 2) for p, v in me_devem.items() if round(v, 2) != 0}

        totais = {
            "faturas_em_aberto": round(sum(v for v in faturas.values() if v < 0), 2),
            "faturas_compensadas": round(sum(v for v in faturas.values() if v > 0), 2),
            "me_devem_em_aberto": round(sum(v for v in me_devem.values() if v < 0), 2),
            "me_devem_compensado": round(sum(v for v in me_devem.values() if v > 0), 2),
        }

        return {
            "owner": current_user.username,
            "saldo_total": round(saldo_total, 2),
            "totais": totais,
            "faturas": faturas,
            "me_devem": me_devem,
        }
    finally:
        s.close()

@blp.route("/whoami", methods=["GET"])
@jwt_required()
def whoami():
    return {"owner": current_user.username}