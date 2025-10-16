from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import models
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hash a password - bcrypt has 72 byte limit"""
    # Encode to bytes to check actual byte length
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        raise ValueError("Password is too long (max 72 bytes)")
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, username: str, password: str, email: str):
    """Create a new user with hashed password"""
    try:
        hashed_pw = get_password_hash(password)
    except ValueError as e:
        raise ValueError(str(e))
    
    user = models.User(
        username=username, 
        hashed_password=hashed_pw, 
        email=email
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise ValueError("Username or email already exists")

def authenticate_user(db: Session, username: str, password: str):
    """Authenticate user by username and password"""
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user