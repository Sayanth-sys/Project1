# from fastapi import FastAPI, Depends, HTTPException, status
# from fastapi.middleware.cors import CORSMiddleware
# from sqlalchemy.orm import Session
# import models, schemas, crud, database, auth

# import os

# # Create DB tables
# models.Base.metadata.create_all(bind=database.engine)

# app = FastAPI(title="GD Simulator Auth")

# # CORS - allow your frontend origin (change for production)
# origins = [
#     "http://localhost:5173",
#     "http://127.0.0.1:5173",
# ]
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Dependency to get DB session
# def get_db():
#     db = database.SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

# @app.post("/signup", response_model=schemas.UserOut)
# def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
#     existing = crud.get_user_by_username(db, user_in.username)
#     if existing:
#         raise HTTPException(status_code=400, detail="Username already exists")
#     user = crud.create_user(db, user_in.username, user_in.password, user_in.email)
#     return user

# @app.post("/login", response_model=schemas.Token)
# def login(data: schemas.LoginData, db: Session = Depends(get_db)):
#     user = crud.authenticate_user(db, data.username, data.password)
#     if not user:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
#     token = auth.create_access_token({"sub": user.username, "user_id": user.id})
#     return {"access_token": token, "token_type": "bearer"}

# @app.get("/me", response_model=schemas.UserOut)
# def read_me():
#     # For simplicity we skip implementing token-based dependency here.
#     # Later: add dependency to verify JWT and extract user.
#     return {"id": 0, "username": "demo", "email": None}

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, schemas, crud, database, auth

# Create DB tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="GD Simulator Auth")

# CORS - allow your frontend origin
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # Common React port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "GD Simulator API is running"}

@app.post("/signup", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if username exists
    existing_user = crud.get_user_by_username(db, user_in.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Username already exists"
        )
    
    # Check if email exists
    existing_email = crud.get_user_by_email(db, user_in.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email already registered"
        )
    
    try:
        user = crud.create_user(db, user_in.username, user_in.password, user_in.email)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to create user"
        )

@app.post("/login", response_model=schemas.Token)
def login(data: schemas.LoginData, db: Session = Depends(get_db)):
    """Login and get access token"""
    user = crud.authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth.create_access_token({"sub": user.username, "user_id": user.id})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me", response_model=schemas.UserOut)
def read_me(current_user: dict = Depends(auth.get_current_user)):
    """Get current user info (protected route)"""
    return current_user

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}