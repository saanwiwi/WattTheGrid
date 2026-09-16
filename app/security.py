from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, extra: Optional[dict] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user_optional(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email = payload.get("sub")
        if not email:
            return None
    except JWTError:
        return None
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_current_user(
    user: Annotated[Optional[User], Depends(get_current_user_optional)],
) -> User:
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user
