# backend/src/models/metrics.py
"""
Metrics Database Model
Stores data quality indicators, scores, and evaluation summaries.
"""

import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from src.db.engine import Base

class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dataset_id = Column(String, index=True, nullable=True)
    completeness_score = Column(Float, default=1.0)
    accuracy_score = Column(Float, default=1.0)
    consistency_score = Column(Float, default=1.0)
    validity_score = Column(Float, default=1.0)
    timeliness_score = Column(Float, default=1.0)
    total_records_analyzed = Column(Integer, default=0)
    total_anomalies_detected = Column(Integer, default=0)
    remediation_rate = Column(Float, default=0.0)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        created_at = self.created_at
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "completeness_score": self.completeness_score,
            "accuracy_score": self.accuracy_score,
            "consistency_score": self.consistency_score,
            "validity_score": self.validity_score,
            "timeliness_score": self.timeliness_score,
            "total_records_analyzed": self.total_records_analyzed,
            "total_anomalies_detected": self.total_anomalies_detected,
            "remediation_rate": self.remediation_rate,
            "details": self.details,
            "created_at": created_at.isoformat() if created_at is not None else None,
        }

# Aliases for plural and legacy import compatibility
Metrics = Metric
DatasetMetrics = Metric