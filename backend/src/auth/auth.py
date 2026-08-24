# backend/src/auth/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials, HTTPBearer, HTTPAuthorizationCredentials
import secrets

from src.auth.tokens import create_access_token, verify_token
from src.config.settings import settings

basic_scheme = HTTPBasic()
bearer_scheme = HTTPBearer(auto_error=False)


def login_with_basic(credentials: HTTPBasicCredentials = Depends(basic_scheme)):
    valid_user = settings.ADMIN_USER
    valid_pass = settings.ADMIN_PASSWORD

    correct_username = secrets.compare_digest(credentials.username, valid_user)
    correct_password = secrets.compare_digest(credentials.password, valid_pass)

    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Basic"},
        )

    token = create_access_token({"sub": credentials.username})
    return {"access_token": token, "token_type": "bearer"}


def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = verify_token(token)
    return payload


def verify_api_key(api_key: str | None):
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
        )

    if api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    return True


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if credentials:
        payload = verify_jwt_token(credentials)
        user = payload.get("sub")
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject",
            )
        return {"auth_method": "jwt", "user": user}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized",
    )













   