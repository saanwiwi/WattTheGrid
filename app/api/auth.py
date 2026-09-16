from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserRole
from app.schemas import TokenOut, UserCreate, UserOut
from app.security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.OPERATOR,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/token", response_model=TokenOut)
async def token(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(access_token=create_access_token(user.email, {"role": user.role.value}))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
