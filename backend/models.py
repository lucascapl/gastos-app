from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from .db import Base
from .extensions import bcrypt

class TxType(enum.Enum):
    normal = "normal"
    reembolso_credito = "reembolso_credito"
    reembolso_debito = "reembolso_debito"

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
class Person(Base):
    __tablename__ = "people"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    value = Column(Numeric(12,2), nullable=False)
    event = Column(String, nullable=False)
    day = Column(Date, nullable=False)

    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    person_id = Column(Integer, ForeignKey("people.id"))

    payment_method = relationship("PaymentMethod")
    category = relationship("Category")
    person = relationship("Person")

    tx_type = Column(Enum(TxType), nullable=False, default=TxType.normal)

class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)