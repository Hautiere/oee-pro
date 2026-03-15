from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise exc
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise exc
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise exc
    return user


def require_roles(*roles: UserRole):
    async def _check(current: Annotated[User, Depends(get_current_user)]) -> User:
        if current.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle requis : {[r.value for r in roles]}",
            )
        return current
    return _check


# Alias pratiques utilisables directement dans les signatures de routes
CurrentUser        = Annotated[User, Depends(get_current_user)]
AdminOnly          = Annotated[User, Depends(require_roles(UserRole.admin))]
SupervisorOrAbove  = Annotated[User, Depends(require_roles(UserRole.supervisor, UserRole.admin))]
MaintenanceOrAbove = Annotated[User, Depends(require_roles(UserRole.maintenance, UserRole.supervisor, UserRole.admin))]
