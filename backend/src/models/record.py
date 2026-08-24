# backend/src/models/record.py
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON, Text, Integer


class Record(SQLModel, table=True):
    __tablename__ = "records"

    id: Optional[int] = Field(default=None, primary_key=True)
    dataset_id: Optional[int] = Field(default=None, sa_column=Column("dataset_id", Integer, nullable=False, index=True))
    data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column("data", JSON, nullable=True))
    flags: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column("flags", JSON, nullable=True))
    note: Optional[str] = Field(default=None, sa_column=Column("note", Text, nullable=True))

    def __repr__(self) -> str:
        return f"<Record id={self.id} dataset_id={self.dataset_id}>"

    def get_dataset(self, session):
        from src.models.dataset import Dataset
        return session.get(Dataset, self.dataset_id)



