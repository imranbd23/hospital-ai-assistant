from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# In production, use connection pool recycling and custom sizes
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Guard against broken/idle database connections
    pool_size=10,        # Maximum persistent connections
    max_overflow=20      # Temporary connections permitted under heavy load
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator:
    """
    FastAPI dependency yielding a transactional SQLAlchemy database session.
    Automatically handles session closing upon completion of the request lifecycle.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
