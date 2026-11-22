# backend/src/db/engine.py
"""
Database Engine & Declarative Base Configuration
Initializes the SQLAlchemy engine, session maker, and declarative Base.
Supports SQLite locally and PostgreSQL (such as Render Postgres) in production.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

raw_url = os.getenv("DATABASE_URL", "sqlite:///./data.db").strip()

# SQLAlchemy requires 'postgresql://' rather than legacy 'postgres://'
if raw_url.startswith("postgres://"):
    DATABASE_URL = raw_url.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = raw_url

is_sqlite = DATABASE_URL.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base required by all models
Base = declarative_base()

__all__ = ["engine", "Base", "SessionLocal", "DATABASE_URL"]

