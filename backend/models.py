from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, ForeignKey, Boolean
from database import Base
import datetime
from sqlalchemy.orm import relationship


# -----------------------------------
# 👤 User Table
# -----------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# -----------------------------------
# 📌 Discussion Table
# -----------------------------------
class Discussion(Base):
    __tablename__ = "discussions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    topic = Column(String(255), nullable=False)
    total_rounds = Column(Integer, default=2)
    human_participant = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship
    responses = relationship("HumanResponse", back_populates="discussion")


# -----------------------------------
# 📌 Human Response Table
# -----------------------------------
class HumanResponse(Base):
    __tablename__ = "human_responses"

    id = Column(Integer, primary_key=True, index=True)

    discussion_id = Column(Integer, ForeignKey("discussions.id"))
    round_number = Column(Integer)

    text = Column(Text, nullable=False)

    grammar_score = Column(Integer)
    clarity_score = Column(Integer)
    relevance_score = Column(Integer)
    politeness_score = Column(Integer)

    feedback = Column(Text)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    discussion = relationship("Discussion", back_populates="responses")