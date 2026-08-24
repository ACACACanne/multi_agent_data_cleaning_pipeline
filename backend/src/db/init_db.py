# backend/src/db/init_db.py

"""
Database Initialization Routine
Creates all tables bound to Base.metadata.
"""

import logging
from src.db.engine import engine, Base
import src.models  # Imports all models to register them with Base.metadata

logger = logging.getLogger("init_db")

def init_db():
    logger.info("Initializing database schema...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema initialized successfully.")
    except Exception as err:
        logger.warning(f"Database schema auto-creation notice: {err}")

if __name__ == "__main__":
    init_db()
