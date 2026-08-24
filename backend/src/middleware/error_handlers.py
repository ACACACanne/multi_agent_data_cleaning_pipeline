# backend/src/middleware/error_handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from src.exceptions import APIError
import traceback
import logging

logger = logging.getLogger("uvicorn.error")


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Convert Starlette HTTPExceptions into the structured contract:
      { status, code, message, details }
    If the exception.detail already contains a structured dict, prefer its fields.
    """
    detail = exc.detail

    if isinstance(detail, dict) and ("message" in detail or "status" in detail):
        payload = {
            "status": detail.get("status", exc.status_code),
            "code": detail.get("code"),
            "message": detail.get("message") or detail.get("detail") or str(detail),
            "details": detail.get("details"),
        }
    else:
        payload = {
            "status": exc.status_code,
            "code": None,
            "message": str(detail) or exc.detail or "HTTP error",
            "details": None,
        }

    return JSONResponse(status_code=exc.status_code, content=payload)


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Return validation errors in the structured contract.
    """
    payload = {
        "status": 422,
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed",
        "details": exc.errors(),
    }
    return JSONResponse(status_code=422, content=payload)


async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler that returns structured payloads and logs server-side trace.
    """
    tb = traceback.format_exc()
    logger.error("Unhandled exception: %s\n%s", str(exc), tb)

    # If it's our APIError, extract fields
    if isinstance(exc, APIError):
        payload = {
            "status": getattr(exc, "status_code", 500),
            "code": getattr(exc, "code", None),
            "message": getattr(exc, "message", "An error occurred"),
            "details": getattr(exc, "details", None),
        }
        status_code = getattr(exc, "status_code", 500)
        return JSONResponse(status_code=status_code, content=payload)

    # Generic 500
    payload = {
        "status": 500,
        "code": "INTERNAL_SERVER_ERROR",
        "message": "Internal server error",
        "details": None,
    }
    return JSONResponse(status_code=500, content=payload)



