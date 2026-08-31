# backend/src/models/__init__.py
"""
Models Export Registry
Imports and registers all SQLAlchemy ORM models and Pydantic validation schemas.
"""

from src.db.engine import Base

# 1. Metrics Models
from src.models.metrics import Metric, Metrics

# 2. Dataset Models
try:
    from src.models.dataset import Dataset
except ImportError:
    from src.models import dataset as _dataset
    Dataset = getattr(_dataset, "Datasets", getattr(_dataset, "Dataset", None))

# 3. Record Models (SQLAlchemy ORM + Pydantic Invariant Schema)
try:
    from src.models.record import Record, ClinicalRecordModel
except ImportError:
    from src.models import record as _record
    Record = getattr(_record, "Records", getattr(_record, "Record", None))
    ClinicalRecordModel = getattr(_record, "ClinicalRecordModel", None)

# 4. Evaluation Models
try:
    from src.models.evaluation import Evaluation
except ImportError:
    try:
        from src.models import evaluation as _evaluation
        Evaluation = getattr(_evaluation, "Evaluations", getattr(_evaluation, "Evaluation", None))
    except ImportError:
        Evaluation = None

# 5. Experiment Models
try:
    from src.models.experiment import Experiment
except ImportError:
    try:
        from src.models import experiment as _experiment
        Experiment = getattr(_experiment, "Experiments", getattr(_experiment, "Experiment", None))
    except ImportError:
        Experiment = None

# 6. Cleaner Models
try:
    from importlib import import_module
    _cleaner = import_module("src.models.cleaner")
    Cleaner = getattr(_cleaner, "Cleaner", None)
    if Cleaner is None:
        Cleaner = getattr(_cleaner, "CleanerJob", None)
except ImportError:
    Cleaner = None

# 7. Remediation Models
try:
    from importlib import import_module
    _remediation = import_module("src.models.remediation")
    Remediation = getattr(_remediation, "Remediation", None)
    if Remediation is None:
        Remediation = getattr(_remediation, "RemediationHistory", None)
except ImportError:
    Remediation = None

# 8. Schema Drift Models
try:
    from importlib import import_module
    _schema = import_module("src.models.schema")
    SchemaDrift = getattr(_schema, "SchemaDrift", None)
    if SchemaDrift is None:
        SchemaDrift = getattr(_schema, "SchemaDriftReport", getattr(_schema, "Schema", None))
except ImportError:
    SchemaDrift = None

# 9. Synthetic Error Models
try:
    from importlib import import_module
    _synthetic = import_module("src.models.synthetic")
    SyntheticError = getattr(_synthetic, "SyntheticError", None)
    if SyntheticError is None:
        SyntheticError = getattr(_synthetic, "Synthetic", None)
except ImportError:
    SyntheticError = None

# 10. Agent Models (SQLAlchemy ORM + Pydantic Agent Reflection Loop States)
try:
    from src.models.agent import (
        AgentRun,
        AuditFinding,
        RemediationAction,
        ValidationReport,
        GraphAgentState,
    )
    Agent = AgentRun  # Backward compatibility alias
except ImportError:
    from src.models import agent as _agent
    AgentRun = getattr(_agent, "AgentRun", getattr(_agent, "AgentLog", getattr(_agent, "Agent", None)))
    Agent = AgentRun
    AuditFinding = getattr(_agent, "AuditFinding", None)
    RemediationAction = getattr(_agent, "RemediationAction", None)
    ValidationReport = getattr(_agent, "ValidationReport", None)
    GraphAgentState = getattr(_agent, "GraphAgentState", None)

__all__ = [
    # Database ORM
    "Base",
    "Metric",
    "Metrics",
    "Dataset",
    "Record",
    "Evaluation",
    "Experiment",
    "Cleaner",
    "Remediation",
    "SchemaDrift",
    "SyntheticError",
    "Agent",
    "AgentRun",
    # Agentic Reflection & Invariant Schemas
    "ClinicalRecordModel",
    "AuditFinding",
    "RemediationAction",
    "ValidationReport",
    "GraphAgentState",
]