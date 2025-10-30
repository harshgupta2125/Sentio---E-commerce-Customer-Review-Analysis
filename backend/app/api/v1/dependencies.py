from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.session import get_db

def get_database_session(db: Session = Depends(get_db)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection error")
    return db