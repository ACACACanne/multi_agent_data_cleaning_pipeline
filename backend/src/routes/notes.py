# backend/src/routes/notes.py

"""
System Notes Route Controller
Handles listing, creating, and deleting system notes and audit remarks.
"""

from fastapi import APIRouter, Body, Path, Query
from typing import Dict, Any, List, Optional
import datetime
import uuid
import logging

router = APIRouter()
logger = logging.getLogger("datara.routes.notes")

SYSTEM_NOTES_STORE = [
    {
        "id": "note_001",
        "title": "KNN Imputation Policy Approved",
        "content": "Clinical data governance committee approved automated KNN imputation on non-critical numerical indicators.",
        "author": "System Auditor",
        "category": "AUDIT",
        "created_at": "2026-08-20T10:15:00Z"
    },
    {
        "id": "note_002",
        "title": "Presidio PII Sanitization Active",
        "content": "All EHR exports must pass through Presidio anonymizer before FHIR serialization.",
        "author": "Compliance Agent",
        "category": "COMPLIANCE",
        "created_at": "2026-08-20T14:30:00Z"
    }
]

# Support root, /notes, and /system/notes paths
@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]], include_in_schema=False)
@router.get("/notes", response_model=List[Dict[str, Any]], include_in_schema=False)
@router.get("/system/notes", response_model=List[Dict[str, Any]], include_in_schema=False)
async def list_system_notes(category: Optional[str] = Query(None)):
    if category:
        return [n for n in SYSTEM_NOTES_STORE if n.get("category") == category]
    return SYSTEM_NOTES_STORE

@router.get("/{note_id}", response_model=Dict[str, Any])
async def get_system_note(note_id: str = Path(...)):
    for note in SYSTEM_NOTES_STORE:
        if str(note["id"]) == str(note_id):
            return note
    return {
        "id": note_id,
        "title": "Note Details",
        "content": "System note content.",
        "author": "System Admin",
        "category": "GENERAL",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }

@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any], include_in_schema=False)
@router.post("/notes", response_model=Dict[str, Any], include_in_schema=False)
@router.post("/system/notes", response_model=Dict[str, Any], include_in_schema=False)
async def create_system_note(payload: Dict[str, Any] = Body(...)):
    new_note = {
        "id": f"note_{uuid.uuid4().hex[:6]}",
        "title": payload.get("title", "New Note"),
        "content": payload.get("content", ""),
        "author": payload.get("author", "Lead Data Scientist"),
        "category": payload.get("category", "GENERAL"),
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    SYSTEM_NOTES_STORE.insert(0, new_note)
    return new_note

@router.delete("/{note_id}", response_model=Dict[str, Any])
async def delete_system_note(note_id: str = Path(...)):
    global SYSTEM_NOTES_STORE
    SYSTEM_NOTES_STORE = [n for n in SYSTEM_NOTES_STORE if str(n["id"]) != str(note_id)]
    return {"id": note_id, "status": "deleted"}

