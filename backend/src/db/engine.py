# backend/src/db/engine.py
"""
Database Engine & Declarative Base Configuration
Initializes the SQLAlchemy engine, session maker, and declarative Base.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Read database URL from environment or default to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data.db")

# SQLite requires 'check_same_thread: False' for multi-threaded FastAPI handlers
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base required by all models
Base = declarative_base()

__all__ = ["engine", "Base", "SessionLocal", "DATABASE_URL"]

