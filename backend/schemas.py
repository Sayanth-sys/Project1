from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str
    email: str  # Changed from EmailStr to str (basic validation)
    
    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if len(v) > 20:
            raise ValueError('Username must be less than 20 characters')
        return v
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        if len(v) > 72:
            raise ValueError('Password must be less than 72 characters')
        return v
    
    @field_validator('email')
    @classmethod
    def email_valid(cls, v):
        if '@' not in v or '.' not in v:
            raise ValueError('Invalid email format')
        return v.lower()

class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LoginData(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str