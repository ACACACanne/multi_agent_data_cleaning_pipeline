# backend/src/utils/logging.py
from loguru import logger
import sys
import os

# Configure logger
logger.remove()
logger.add(sys.stdout, level="INFO")
# Ensure logs directory exists
os.makedirs("backend/logs", exist_ok=True)
logger.add("backend/logs/app.log", rotation="1 MB", level="INFO")


def get_logger(name: str):
    return logger.bind(module=name)




