# backend/src/db/session.py
"""
Database Session Provider
Provides the FastAPI dependency for database session lifecycles.
"""

from typing import Generator
from sqlalchemy.orm import Session
from src.db.engine import SessionLocal, engine, Base

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a thread-safe database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Aliases to support routes importing either 'get_session' or 'get_db'
get_session = get_db

__all__ = ["get_db", "get_session", "SessionLocal", "engine", "Base"]
