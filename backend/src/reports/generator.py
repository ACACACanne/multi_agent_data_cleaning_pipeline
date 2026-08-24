# src/reports/generator.py
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

log = logging.getLogger("reports.generator")
log.addHandler(logging.NullHandler())


@dataclass
class Mutation:
    row_index: int | str
    column: str
    original_value: str
    remediated_value: str


def _read_csv_safe(path: str) -> pd.DataFrame:
    """
    Read CSV robustly, preserving original row order and avoiding dtype surprises.
    Returns an empty DataFrame if file not found.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"CSV not found: {path}")
    try:
        # read everything as string to make comparisons predictable
        return pd.read_csv(p, dtype=str, keep_default_na=False, na_values=["", "NA", "NaN"])
    except Exception:
        # fallback: let pandas infer types if strict read fails
        return pd.read_csv(p)


def calculate_delta(
    initial_csv: str,
    final_csv: str,
    *,
    compare_index: Optional[str] = None,
    sample_limit: int = 100,
) -> Dict[str, Any]:
    """
    Compare two CSVs and return a structured metrics dict describing changes.

    Args:
        initial_csv: path to original CSV
        final_csv: path to remediated CSV
        compare_index: optional column name to use as stable index (e.g., 'id').
                       If not provided, row position is used.
        sample_limit: maximum number of mutation records to include in the 'mutations_logged' sample.

    Returns:
        dict with keys:
          - total_rows_processed
          - columns_analyzed
          - total_mutations
          - mutations_logged (list of Mutation dicts, up to sample_limit)
          - structural_change (bool)
          - notes (optional)
    """
    df_old = _read_csv_safe(initial_csv)
    df_new = _read_csv_safe(final_csv)

    metrics: Dict[str, Any] = {
        "total_rows_processed": len(df_old),
        "columns_analyzed": list(df_old.columns),
        "total_mutations": 0,
        "mutations_logged": [],
        "structural_change": False,
        "notes": [],
    }

    # Quick structural check
    if list(df_old.columns) != list(df_new.columns):
        metrics["structural_change"] = True
        metrics["notes"].append("Column set changed between initial and final CSV.")
        # still attempt to compare intersection of columns
    common_columns = [c for c in df_old.columns if c in df_new.columns]

    # Align by compare_index if provided and present in both
    if compare_index and compare_index in df_old.columns and compare_index in df_new.columns:
        df_old_indexed = df_old.set_index(compare_index)
        df_new_indexed = df_new.set_index(compare_index)
        # consider only intersection of indices
        common_index = df_old_indexed.index.intersection(df_new_indexed.index)
        df_old_cmp = df_old_indexed.loc[common_index, common_columns]
        df_new_cmp = df_new_indexed.loc[common_index, common_columns]
    else:
        # align by position: take min rows
        min_rows = min(len(df_old), len(df_new))
        if len(df_old) != len(df_new):
            metrics["notes"].append("Row count differs between initial and final CSV; comparing up to min rows.")
        df_old_cmp = df_old.iloc[:min_rows][common_columns].reset_index(drop=True)
        df_new_cmp = df_new.iloc[:min_rows][common_columns].reset_index(drop=True)

    # Use pandas compare for efficient diffing (works elementwise)
    try:
        diff = df_old_cmp.compare(df_new_cmp, keep_equal=False, result_names=("original", "remediated"))
    except Exception:
        # Fallback to manual elementwise comparison
        diff_records: List[Mutation] = []
        for i in range(len(df_old_cmp)):
            for col in common_columns:
                old = str(df_old_cmp.iloc[i].get(col, "")) if col in df_old_cmp.columns else ""
                new = str(df_new_cmp.iloc[i].get(col, "")) if col in df_new_cmp.columns else ""
                if old != new:
                    diff_records.append(Mutation(row_index=int(i), column=col, original_value=old, remediated_value=new))
        metrics["total_mutations"] = len(diff_records)
        metrics["mutations_logged"] = [asdict(m) for m in diff_records[:sample_limit]]
        return metrics

    # When using DataFrame.compare, iterate rows to collect mutations
    mutations: List[Mutation] = []
    # diff has MultiIndex columns when comparing; iterate to extract changes
    for row_idx in diff.index:
        row = diff.loc[row_idx]
        # row is a Series with MultiIndex columns (col, 'original'/'remediated')
        # group by top-level column name
        grouped = {}
        for (col, side), val in row.items():
            grouped.setdefault(col, {})[side] = val
        for col, sides in grouped.items():
            orig = "" if sides.get("original") is None else str(sides.get("original"))
            rem = "" if sides.get("remediated") is None else str(sides.get("remediated"))
            if orig != rem:
                # If compare_index was used, row_idx may be an index value; preserve it.
                if isinstance(row_idx, int):
                    idx_for_report = int(row_idx)
                elif isinstance(row_idx, str) and row_idx.isdigit():
                    idx_for_report = int(row_idx)
                else:
                    idx_for_report = str(row_idx)

                mutations.append(
                    Mutation(
                        row_index=idx_for_report,
                        column=col,
                        original_value=orig,
                        remediated_value=rem,
                    )
                )

    metrics["total_mutations"] = len(mutations)
    metrics["mutations_logged"] = [asdict(m) for m in mutations[:sample_limit]]
    return metrics


def compile_markdown_report(metrics: Dict[str, Any], state: Optional[Dict[str, Any]] = None) -> str:
    """
    Produce a human-readable Markdown report summarizing metrics and a sample of mutations.

    Args:
        metrics: output from calculate_delta
        state: optional runtime state (e.g., generated_code, agent decisions) to include

    Returns:
        Markdown string
    """
    state = state or {}
    lines: List[str] = []
    lines.append("# Clinical Data Cleaning Report")
    lines.append(f"**Execution Date:** {datetime.utcnow().isoformat()} UTC")
    lines.append("")
    lines.append(f"**Total Rows Processed:** {metrics.get('total_rows_processed')}")
    lines.append(f"**Columns Analyzed:** {', '.join(metrics.get('columns_analyzed', []))}")
    lines.append(f"**Total Mutations:** {metrics.get('total_mutations')}")
    if metrics.get("structural_change"):
        lines.append("")
        lines.append("> **Note:** Structural changes detected between initial and final CSVs.")
        for n in metrics.get("notes", []):
            lines.append(f"> {n}")
    lines.append("")
    lines.append("## Mutations (sample)")
    mutations = metrics.get("mutations_logged", [])
    if not mutations:
        lines.append("No mutations detected in the sampled rows.")
    else:
        for m in mutations[:50]:
            lines.append(f"- Row `{m['row_index']}` | **{m['column']}**: `{m['original_value']}` → `{m['remediated_value']}`")
    lines.append("")
    lines.append("## Executed / Generated State")
    generated_code = state.get("generated_code", None)
    if generated_code:
        lines.append("```python")
        lines.append(generated_code)
        lines.append("```")
    else:
        lines.append("_No generated code captured in state._")
    lines.append("")
    lines.append("## Key Takeaways")
    lines.append(f"- Rows processed: {metrics.get('total_rows_processed')}")
    lines.append(f"- Mutations: {metrics.get('total_mutations')}")
    lines.append("")
    return "\n".join(lines)


def save_report_json(metrics: Dict[str, Any], state: Optional[Dict[str, Any]] = None, out_path: str = "report.json") -> str:
    """
    Save a JSON report containing metrics and optional state. Returns the written path.
    """
    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "metrics": metrics,
        "state": state or {},
    }
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    return str(p.resolve())


# Convenience CLI-like helper for quick runs
def generate_report_files(
    initial_csv: str,
    final_csv: str,
    *,
    out_json: str = "report.json",
    out_md: str = "report.md",
    compare_index: Optional[str] = None,
    sample_limit: int = 100,
    state: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Run delta calculation, save JSON and Markdown reports, and return (json_path, md_path).
    """
    metrics = calculate_delta(initial_csv, final_csv, compare_index=compare_index, sample_limit=sample_limit)
    json_path = save_report_json(metrics, state=state, out_path=out_json)
    md = compile_markdown_report(metrics, state=state)
    md_path = Path(out_md)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(md, encoding="utf-8")
    return json_path, str(md_path.resolve())


if __name__ == "__main__":  # pragma: no cover - simple CLI helper
    import argparse

    parser = argparse.ArgumentParser(description="Generate data cleaning delta report")
    parser.add_argument("initial", help="Path to initial CSV")
    parser.add_argument("final", help="Path to final CSV")
    parser.add_argument("--out-json", default="report.json")
    parser.add_argument("--out-md", default="report.md")
    parser.add_argument("--index", default=None, help="Optional column name to use as stable index")
    args = parser.parse_args()

    try:
        j, m = generate_report_files(args.initial, args.final, out_json=args.out_json, out_md=args.out_md, compare_index=args.index)
        print("Wrote:", j, m)
    except Exception as exc:
        log.exception("Report generation failed: %s", exc)
        raise

