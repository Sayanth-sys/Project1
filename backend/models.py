from sqlalchemy import Column, Integer, String, DateTime, JSON
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Example table for later performance/feedback
class Performance(Base):
    __tablename__ = "performances"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    session_id = Column(String, index=True)
    metrics = Column(JSON)  # store scores, etc.
    feedback = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
