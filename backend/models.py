from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, Date, Numeric, ForeignKey, Enum, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .db import Base
from .extensions import bcrypt

class TxType(enum.Enum):
    normal = "normal"
    reembolso_credito = "reembolso_credito"
    reembolso_debito = "reembolso_debito"

class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    initial_balance = Column(Numeric(12,2), nullable=False, default=0)

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_categories_user_name"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    name = Column(String, nullable=False)

    user = relationship("User")

class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_payment_methods_user_name"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    name = Column(String, nullable=False)

    user = relationship("User")

class Bank(Base):
    __tablename__ = "banks"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_banks_user_name"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    closing_day = Column(Integer, nullable=True)
    investments_only = Column(Boolean, nullable=False, default=False)

    user = relationship("User")

class Person(Base):
    __tablename__ = "people"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_people_user_name"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    name = Column(String, nullable=False)

    user = relationship("User")


class MonthlyBudget(Base):
    __tablename__ = "monthly_budgets"
    __table_args__ = (
        CheckConstraint("year >= 1 AND year <= 9999", name="ck_monthly_budgets_year"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_monthly_budgets_month"),
        CheckConstraint("amount > 0", name="ck_monthly_budgets_amount"),
        UniqueConstraint(
            "user_id", "category_id", "year", "month",
            name="uq_monthly_budgets_user_category_period",
        ),
        Index("ix_monthly_budgets_user_year_month", "user_id", "year", "month"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    category = relationship("Category")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)

    value = Column(Numeric(12,2), nullable=False)
    event = Column(String, nullable=False)
    day = Column(Date, nullable=False)
    bank = Column(String, nullable=True)
    is_projected = Column(Boolean, nullable=False, default=False, index=True)
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)

    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    person_id = Column(Integer, ForeignKey("people.id"))

    payment_method = relationship("PaymentMethod")
    category = relationship("Category")
    person = relationship("Person")

    tx_type = Column(Enum(TxType), nullable=False, default=TxType.normal)
