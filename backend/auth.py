    # from passlib.context import CryptContext
    # from datetime import datetime, timedelta
    # from jose import jwt
    # import os

    # # Password hashing
    # pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # # JWT settings - in prod store SECRET_KEY in env
    # SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    # ALGORITHM = "HS256"
    # ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

    # def get_password_hash(password: str) -> str:
    #     return pwd_context.hash(password)

    # def verify_password(plain_password: str, hashed_password: str) -> bool:
    #     return pwd_context.verify(plain_password, hashed_password)

    # def create_access_token(data: dict, expires_delta: timedelta | None = None):
    #     to_encode = data.copy()
    #     expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    #     to_encode.update({"exp": expire})
    #     token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    #     return token

from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import crud
from database import SessionLocal

# Secret key - CHANGE THIS IN PRODUCTION!
SECRET_KEY = "AIzaSyBU6Y5XtN_8ZD6GuzlgeYIAbTamlcMTf78"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_db():
    """Dependency for database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = crud.get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    
    return user
