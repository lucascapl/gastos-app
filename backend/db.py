from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, scoped_session
import os

try:
    from dotenv import load_dotenv
    load_dotenv()  # procura .env no CWD (rode o app a partir da raiz do projeto)
except Exception:
    pass

DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///gastos.db"

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False, autocommit=False))
Base = declarative_base()