# src/privacy/presidio_scrubber.py
from __future__ import annotations

import logging
from importlib import import_module
from typing import Iterable, List, Optional, Sequence, Dict, Any, Callable
from concurrent.futures import ThreadPoolExecutor
import functools

log = logging.getLogger("privacy.presidio_scrubber")


class PresidioNotAvailable(RuntimeError):
    """Raised when Presidio analyzer/anonymizer cannot be imported or initialized."""


def _load_presidio_engines():
    """
    Import Presidio AnalyzerEngine and AnonymizerEngine.

    Returns:
        (AnalyzerEngineClass, AnonymizerEngineClass)

    Raises:
        PresidioNotAvailable: if required packages are missing or do not expose expected classes.
    """
    try:
        analyzer_mod = import_module("presidio_analyzer")
        anonymizer_mod = import_module("presidio_anonymizer")
    except Exception as exc:
        raise PresidioNotAvailable(
            "Presidio packages not installed. Install 'presidio-analyzer' and 'presidio-anonymizer'."
        ) from exc

    try:
        AnalyzerEngine = getattr(analyzer_mod, "AnalyzerEngine")
        AnonymizerEngine = getattr(anonymizer_mod, "AnonymizerEngine")
    except AttributeError as exc:
        raise PresidioNotAvailable(
            "Presidio modules found but expected classes are missing."
        ) from exc

    return AnalyzerEngine, AnonymizerEngine


class HealthcarePHIScrubber:
    """
    Wrapper around Presidio Analyzer and Anonymizer to scrub PHI from text.

    Features:
    - Lazy import/initialization of Presidio engines.
    - Configurable target entities and anonymizer operators.
    - Helpers to scrub single strings, batches, pandas Series/DataFrame columns, and lists of records.
    - Optional parallelization for batch operations.

    Example:
        scrubber = HealthcarePHIScrubber()
        clean = scrubber.scrub_text("Patient John Doe, born 1980-01-01, phone 555-1234")
    """

    DEFAULT_ENTITIES = [
        "PERSON",
        "PHONE_NUMBER",
        "EMAIL_ADDRESS",
        "US_SSN",
        "US_PASSPORT",
        "DATE_TIME",
        "CREDIT_CARD",
        "IBAN_CODE",
        "LOCATION",
    ]

    def __init__(
        self,
        entities: Optional[Sequence[str]] = None,
        analyzer_kwargs: Optional[Dict[str, Any]] = None,
        anonymizer_kwargs: Optional[Dict[str, Any]] = None,
        max_workers: int = 4,
    ) -> None:
        """
        Do not import Presidio at module import time; import lazily when first used.

        Args:
            entities: list of entity names to detect (defaults to DEFAULT_ENTITIES).
            analyzer_kwargs: kwargs passed to AnalyzerEngine on initialization.
            anonymizer_kwargs: kwargs passed to AnonymizerEngine on initialization.
            max_workers: thread pool size for batch operations.
        """
        self._AnalyzerEngineClass = None
        self._AnonymizerEngineClass = None
        self._analyzer = None
        self._anonymizer = None
        self.entities = list(entities or self.DEFAULT_ENTITIES)
        self.analyzer_kwargs = analyzer_kwargs or {}
        self.anonymizer_kwargs = anonymizer_kwargs or {}
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        log.debug("HealthcarePHIScrubber initialized with entities=%s", self.entities)

    def _ensure_engines(self) -> None:
        """Lazy import and instantiate Presidio engines if not already done."""
        if self._analyzer is not None and self._anonymizer is not None:
            return
        try:
            AnalyzerEngine, AnonymizerEngine = _load_presidio_engines()
        except PresidioNotAvailable:
            log.exception("Presidio engines not available")
            raise
        # instantiate with provided kwargs
        self._analyzer = AnalyzerEngine(**self.analyzer_kwargs)
        self._anonymizer = AnonymizerEngine(**self.anonymizer_kwargs)
        log.debug("Presidio Analyzer and Anonymizer engines instantiated")

    def scrub_text(self, text: str, entities: Optional[Sequence[str]] = None) -> str:
        """
        Scrub a single text string and return anonymized text.

        Args:
            text: input text to scrub.
            entities: optional override list of entities to detect.

        Returns:
            anonymized text (string).
        """
        if not isinstance(text, str) or not text.strip():
            return text
        self._ensure_engines()
        assert self._analyzer is not None and self._anonymizer is not None
        target_entities = list(entities or self.entities)
        try:
            analysis_results = self._analyzer.analyze(
                text=text, language="en", entities=target_entities
            )
            anonymized_result = self._anonymizer.anonymize(
                text=text, analyzer_results=analysis_results
            )
            return getattr(anonymized_result, "text", str(anonymized_result))
        except Exception:
            log.exception("Error scrubbing text")
            # On failure, return original text to avoid data loss
            return text

    def scrub_batch_texts(
        self,
        texts: Iterable[str],
        entities: Optional[Sequence[str]] = None,
        parallel: bool = True,
    ) -> List[str]:
        """
        Scrub a batch of texts. Returns list of anonymized texts in same order.

        Args:
            texts: iterable of strings.
            entities: optional override entities.
            parallel: whether to run in parallel using ThreadPoolExecutor.

        Returns:
            list of anonymized strings.
        """
        texts_list = list(texts)
        if not texts_list:
            return []

        scrub_fn: Callable[[str], str] = functools.partial(self.scrub_text, entities=entities)

        if parallel:
            futures = [self._executor.submit(scrub_fn, t) for t in texts_list]
            results = []
            for f in futures:
                try:
                    results.append(f.result())
                except Exception:
                    log.exception("Batch scrub task failed for one item")
                    results.append("")  # preserve ordering
            return results
        else:
            return [scrub_fn(t) for t in texts_list]

    def scrub_dataframe(
        self,
        df,
        column: str,
        inplace: bool = False,
        entities: Optional[Sequence[str]] = None,
        parallel: bool = False,
    ):
        """
        Scrub a pandas DataFrame column in-place or return a new DataFrame copy.

        Args:
            df: pandas DataFrame
            column: column name to scrub
            inplace: if True modify df in place and return df; otherwise return a copy
            entities: optional override entities
            parallel: whether to use parallel batch scrubbing

        Returns:
            DataFrame with scrubbed column.
        """
        try:
            import pandas as pd  # local import to keep optional dependency light
        except Exception:
            raise RuntimeError("pandas is required for scrub_dataframe")

        if column not in df.columns:
            raise KeyError(f"Column not found in DataFrame: {column}")

        target = df if inplace else df.copy()
        texts = target[column].astype(str).tolist()
        scrubbed = self.scrub_batch_texts(texts, entities=entities, parallel=parallel)
        target[column] = pd.Series(scrubbed, index=target.index)
        return target

    def scrub_records(
        self,
        records: Iterable[Dict[str, Any]],
        fields: Sequence[str],
        entities: Optional[Sequence[str]] = None,
        parallel: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Scrub specified fields in a list/iterable of dict records.

        Args:
            records: iterable of dict-like records
            fields: list of field names to scrub in each record
            entities: optional override entities
            parallel: whether to scrub field values in parallel per-field batch

        Returns:
            list of new records with scrubbed fields (original records are not modified).
        """
        recs = [dict(r) for r in records]
        if not recs:
            return []

        for field in fields:
            values = [str(r.get(field, "")) for r in recs]
            scrubbed = self.scrub_batch_texts(values, entities=entities, parallel=parallel)
            for i, val in enumerate(scrubbed):
                recs[i][field] = val
        return recs

    def close(self) -> None:
        """Shutdown thread pool and release resources."""
        try:
            self._executor.shutdown(wait=True)
        except Exception:
            log.exception("Error shutting down executor")
        # If Presidio engines expose close/dispose methods, call them here (best-effort)
        try:
            if self._analyzer and hasattr(self._analyzer, "close"):
                self._analyzer.close()
            if self._anonymizer and hasattr(self._anonymizer, "close"):
                self._anonymizer.close()
        except Exception:
            log.debug("Presidio engines did not support close or failed during close")

    # Context manager support
    def __enter__(self) -> "HealthcarePHIScrubber":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

