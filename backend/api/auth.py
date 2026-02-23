"""Auth API routes: register, login, get current user."""

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from db import get_db
from models.user import User
from services.auth_service import authenticate_user, get_current_user, register_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def get_authenticated_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: extract Bearer token and return current user.

    Use as ``Depends(get_authenticated_user)`` on any protected route.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authorization header",
        )
    token = authorization[7:]
    try:
        return get_current_user(token, db)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> UserResponse:
    try:
        user = register_user(body.email, body.password, body.display_name, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return UserResponse(
        id=str(user.id), email=user.email, display_name=user.display_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        token = authenticate_user(body.email, body.password, db)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_authenticated_user)) -> UserResponse:
    return UserResponse(
        id=str(user.id), email=user.email, display_name=user.display_name,
    )
