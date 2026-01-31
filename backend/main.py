from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, schemas, crud, database, auth
import traceback

# Create DB tables
try:
    models.Base.metadata.create_all(bind=database.engine)
    print("✓ Database tables created successfully")
except Exception as e:
    print(f"✗ Error creating database tables: {e}")
    traceback.print_exc()

app = FastAPI(title="GD Simulator Auth")

# CORS - allow your frontend origin
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
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
    try:
        print(f"📝 Signup attempt - Username: {user_in.username}, Email: {user_in.email}")
        
        # Check if username exists
        existing_user = crud.get_user_by_username(db, user_in.username)
        if existing_user:
            print(f"❌ Username '{user_in.username}' already exists")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Username already exists"
            )
        
        # Check if email exists
        existing_email = crud.get_user_by_email(db, user_in.email)
        if existing_email:
            print(f"❌ Email '{user_in.email}' already registered")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Email already registered"
            )
        
        print("🔐 Hashing password and creating user...")
        user = crud.create_user(db, user_in.username, user_in.password, user_in.email)
        print(f"✅ User created successfully - ID: {user.id}, Username: {user.username}")
        return user
        
    except HTTPException:
        raise
    except ValueError as e:
        print(f"❌ Validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"🔥 UNEXPECTED ERROR: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to create user: {str(e)}"
        )

@app.post("/login", response_model=schemas.Token)
def login(data: schemas.LoginData, db: Session = Depends(get_db)):
    """Login and get access token"""
    try:
        print(f"🔑 Login attempt - Username: {data.username}")
        user = crud.authenticate_user(db, data.username, data.password)
        if not user:
            print(f"❌ Authentication failed for username: {data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = auth.create_access_token({"sub": user.username, "user_id": user.id})
        print(f"✅ Login successful - Username: {user.username}")
        return {"access_token": token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥 Login error: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@app.get("/me", response_model=schemas.UserOut)
def read_me(current_user: dict = Depends(auth.get_current_user)):
    """Get current user info (protected route)"""
    return current_user

@app.get("/health")
def health_check():
    try:
        db = database.SessionLocal()
        db.execute("SELECT 1")
        db.close()
        return {
            "status": "healthy",
            "database": "connected",
            "auth": "ready"
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
