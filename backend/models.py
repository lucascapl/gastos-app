from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from .db import Base

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
