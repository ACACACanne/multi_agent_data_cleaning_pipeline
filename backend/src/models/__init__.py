# backend/src/models/__init__.py
"""
Models Export Registry
Imports and registers all SQLAlchemy models with Base.metadata.
"""

from src.db.engine import Base

# 1. Metrics Models
from src.models.metrics import Metric, Metrics

# 2. Dataset Models
try:
    from src.models.dataset import Dataset
except ImportError:
    from src.models import dataset as _dataset

    Dataset = getattr(_dataset, "Datasets", None)

# 3. Record Models
try:
    from src.models.record import Record
except ImportError:
    from src.models import record as _record

    Record = getattr(_record, "Records", None)

# 4. Evaluation Models
try:
    from src.models.evaluation import Evaluation
except ImportError:
    try:
        from src.models import evaluation as _evaluation

        Evaluation = getattr(_evaluation, "Evaluations", None)
    except ImportError:
        Evaluation = None

# 5. Experiment Models
try:
    from src.models.experiment import Experiment
except ImportError:
    try:
        from src.models import experiment as _experiment

        Experiment = getattr(_experiment, "Experiments", None)
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
        SchemaDrift = getattr(_schema, "Schema", None)
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

# 10. Agent Models
try:
    from importlib import import_module

    _agent = import_module("src.models.agent")
    Agent = getattr(_agent, "Agent", None)
    if Agent is None:
        Agent = getattr(_agent, "AgentLog", None)
except ImportError:
    Agent = None

__all__ = [
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
]