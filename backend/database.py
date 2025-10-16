# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, declarative_base
# import os

# # For dev: SQLite file in backend folder
# SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gd.db")

# # SQLite needs check_same_thread
# engine = create_engine(
#     SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
# )
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()


from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///./gd_simulator.db"

# For PostgreSQL, use:
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/dbname"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Only needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()