# backend/src/exceptions.py
from typing import Any, Optional
from fastapi import HTTPException


class APIError(HTTPException):
    """
    APIError extends HTTPException to carry a structured payload.
    Use: raise APIError(status_code=400, code="INVALID_PAYLOAD", message="...", details={...})
    The HTTPException.detail will contain a dict with the structured contract:
      { "status": <int>, "code": "<optional string>", "message": "<string>", "details": <optional object> }
    """

    def __init__(
        self,
        status_code: int = 500,
        code: Optional[str] = None,
        message: str = "Internal server error",
        details: Optional[Any] = None,
    ):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(
            status_code=status_code,
            detail={
                "status": status_code,
                "code": code,
                "message": message,
                "details": details,
            },
        )


