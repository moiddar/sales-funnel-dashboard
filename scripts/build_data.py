"""
Build static JSON data files from raw_data.xlsx for the dashboard.

Metrics are computed per the following definitions:

KPI "What entered the pipeline?":
  - All quarters: first row per unique_id, exclude if first stage is terminal. Sum amounts.
  - Specific quarter: start-of-quarter pipeline snapshot (= funnel_value).

KPI "What did we actually close?":
  - All quarters: opps whose absolute latest stage is Closed Won.
  - Specific quarter: within-quarter records, latest per opp, filter to Closed Won.

KPI "Typical deal worth?":
  - All quarters: average amount across ALL unique_ids using latest row, regardless of stage.
  - Specific quarter: same, but only records before quarter end.

Funnel chart: latest stage per opp (excluding Closed Lost). For specific quarter,
  latest stage per opp using records before quarter end.

Bar chart: uses funnel_value (start-of-quarter pipeline) and closed_won_value per quarter.
"""

import json
import os
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_DATA = ROOT / "raw_data.xlsx"
OUTPUT_DIR = ROOT / "dashboard" / "public" / "data"

TERMINAL_STAGES = {"Closed Won", "Closed Lost"}

QUARTERS = [
    ("2024Q1", "2024-01-01", "2024-04-01"),
    ("2024Q2", "2024-04-01", "2024-07-01"),
    ("2024Q3", "2024-07-01", "2024-10-01"),
    ("2024Q4", "2024-10-01", "2025-01-01"),
    ("2025Q1", "2025-01-01", "2025-04-01"),
    ("2025Q2", "2025-04-01", "2025-07-01"),
    ("2025Q3", "2025-07-01", "2025-10-01"),
    ("2025Q4", "2025-10-01", "2026-01-01"),
    ("2026Q1", "2026-01-01", "2026-04-01"),
]

PARTIAL_QUARTERS = {"2026Q1"}


def load_data() -> pd.DataFrame:
    df = pd.read_excel(RAW_DATA)
    df["history_date"] = pd.to_datetime(df["history_date"])
    df["close_date"] = pd.to_datetime(df["close_date"])
    # Deduplicate: one row per (Unique_ID, Amount, OpportunityProductGroup, Vertical, stage).
    # Tie-break: most recent history_date, then most recent close_date.
    dedup_keys = ["Unique_ID", "Amount", "OpportunityProductGroup", "Vertical", "stage"]
    df = df.sort_values(["history_date", "close_date"], ascending=[False, False])
    df = df.drop_duplicates(subset=dedup_keys, keep="first").reset_index(drop=True)
    return df


def get_funnel_snapshot(df: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    """Open pipeline at the start of the quarter.

    For each opportunity, find its most recent record before the quarter start.
    Include it if that record is non-terminal.
    """
    start_ts = pd.Timestamp(start)
    pre_quarter = df[df["history_date"] < start_ts]
    if pre_quarter.empty:
        return pd.DataFrame()
    sorted_df = pre_quarter.sort_values(
        ["history_date", "stage"], ascending=[True, True]
    )
    last_per_opp = sorted_df.groupby("Unique_ID").last().reset_index()
    return last_per_opp[~last_per_opp["stage"].isin(TERMINAL_STAGES)]


def get_closed_won_in_quarter(df: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    """Get opportunities whose latest stage within the quarter is Closed Won.

    Filter to records within the quarter, take the latest per opp, keep only Closed Won.
    """
    start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)
    in_quarter = df[(df["history_date"] >= start_ts) & (df["history_date"] < end_ts)]
    if in_quarter.empty:
        return pd.DataFrame()
    sorted_df = in_quarter.sort_values(["history_date", "stage"], ascending=[True, True])
    latest_per_opp = sorted_df.groupby("Unique_ID").last().reset_index()
    return latest_per_opp[latest_per_opp["stage"] == "Closed Won"]


def get_all_deals_snapshot(df: pd.DataFrame, cutoff: str | None = None) -> pd.DataFrame:
    """All unique_ids, latest row per unique_id, regardless of stage.

    Used for the "typical deal worth" KPI.
    """
    if cutoff is not None:
        subset = df[df["history_date"] < pd.Timestamp(cutoff)]
    else:
        subset = df
    if subset.empty:
        return pd.DataFrame()
    sorted_df = subset.sort_values(["history_date", "stage"], ascending=[True, True])
    return sorted_df.groupby("Unique_ID").last().reset_index()


def build_breakdowns(subset: pd.DataFrame) -> dict:
    """Build nested breakdowns by vertical, product, and cross-tab."""
    by_vertical = {}
    for v, grp in subset.groupby("Vertical"):
        by_vertical[v] = {"value": int(grp["Amount"].sum()), "count": len(grp)}

    by_product = {}
    for p, grp in subset.groupby("OpportunityProductGroup"):
        by_product[p] = {"value": int(grp["Amount"].sum()), "count": len(grp)}

    by_vp = {}
    for (v, p), grp in subset.groupby(["Vertical", "OpportunityProductGroup"]):
        by_vp[f"{v}|{p}"] = {"value": int(grp["Amount"].sum()), "count": len(grp)}

    return by_vertical, by_product, by_vp


def get_first_pipeline_entries(df: pd.DataFrame) -> pd.DataFrame:
    """For each opportunity, find its first record. Exclude if first stage is terminal.

    Returns a DataFrame with one row per opportunity, tagged with the quarter
    it first appeared in.
    """
    sorted_df = df.sort_values(["history_date", "stage"], ascending=[True, True])
    first_per_opp = sorted_df.groupby("Unique_ID").first().reset_index()
    # Exclude opps whose first-ever record is terminal
    first_per_opp = first_per_opp[~first_per_opp["stage"].isin(TERMINAL_STAGES)]

    # Tag each opportunity with its first-entry quarter
    first_per_opp["entry_quarter"] = None
    for label, start, end in QUARTERS:
        start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)
        mask = (first_per_opp["history_date"] >= start_ts) & (first_per_opp["history_date"] < end_ts)
        first_per_opp.loc[mask, "entry_quarter"] = label

    # Assign pre-range entries to the earliest quarter (already in pipeline at start)
    earliest_quarter = QUARTERS[0][0]
    earliest_start = pd.Timestamp(QUARTERS[0][1])
    first_per_opp.loc[
        (first_per_opp["entry_quarter"].isna()) & (first_per_opp["history_date"] < earliest_start),
        "entry_quarter",
    ] = earliest_quarter

    return first_per_opp.dropna(subset=["entry_quarter"])


def build_quarterly_summary(df: pd.DataFrame) -> list[dict]:
    first_entries = get_first_pipeline_entries(df)

    results = []
    for label, start, end in QUARTERS:
        funnel = get_funnel_snapshot(df, start, end)
        closed = get_closed_won_in_quarter(df, start, end)
        all_deals = get_all_deals_snapshot(df, end)

        # Opportunities whose first-ever pipeline appearance is this quarter
        qfe = first_entries[first_entries["entry_quarter"] == label]

        funnel_value = int(funnel["Amount"].sum()) if not funnel.empty else 0
        funnel_count = len(funnel)
        closed_value = int(closed["Amount"].sum()) if not closed.empty else 0
        closed_count = len(closed)
        conversion = round(closed_value / funnel_value * 100, 1) if funnel_value else 0
        avg_deal = round(funnel_value / funnel_count) if funnel_count else 0

        fe_value = int(qfe["Amount"].sum()) if not qfe.empty else 0
        fe_count = len(qfe)

        all_deals_total = int(all_deals["Amount"].sum()) if not all_deals.empty else 0
        all_deals_count = len(all_deals)

        fv, fp, fvp = build_breakdowns(funnel) if not funnel.empty else ({}, {}, {})
        cv, cp, cvp = build_breakdowns(closed) if not closed.empty else ({}, {}, {})
        ev, ep, evp = build_breakdowns(qfe) if not qfe.empty else ({}, {}, {})
        adv, adp, advp = build_breakdowns(all_deals) if not all_deals.empty else ({}, {}, {})

        all_v = set(list(fv.keys()) + list(cv.keys()) + list(ev.keys()) + list(adv.keys()))
        all_p = set(list(fp.keys()) + list(cp.keys()) + list(ep.keys()) + list(adp.keys()))
        all_vp = set(list(fvp.keys()) + list(cvp.keys()) + list(evp.keys()) + list(advp.keys()))

        results.append({
            "quarter": label,
            "funnel_value": funnel_value,
            "funnel_count": funnel_count,
            "closed_won_value": closed_value,
            "closed_won_count": closed_count,
            "first_entry_value": fe_value,
            "first_entry_count": fe_count,
            "all_deals_total": all_deals_total,
            "all_deals_count": all_deals_count,
            "conversion_rate": conversion,
            "avg_deal_size": avg_deal,
            "is_partial": label in PARTIAL_QUARTERS,
            "by_vertical": {
                v: {
                    "funnel_value": fv.get(v, {}).get("value", 0),
                    "funnel_count": fv.get(v, {}).get("count", 0),
                    "closed_won_value": cv.get(v, {}).get("value", 0),
                    "closed_won_count": cv.get(v, {}).get("count", 0),
                    "first_entry_value": ev.get(v, {}).get("value", 0),
                    "first_entry_count": ev.get(v, {}).get("count", 0),
                    "all_deals_total": adv.get(v, {}).get("value", 0),
                    "all_deals_count": adv.get(v, {}).get("count", 0),
                }
                for v in all_v
            },
            "by_product": {
                p: {
                    "funnel_value": fp.get(p, {}).get("value", 0),
                    "funnel_count": fp.get(p, {}).get("count", 0),
                    "closed_won_value": cp.get(p, {}).get("value", 0),
                    "closed_won_count": cp.get(p, {}).get("count", 0),
                    "first_entry_value": ep.get(p, {}).get("value", 0),
                    "first_entry_count": ep.get(p, {}).get("count", 0),
                    "all_deals_total": adp.get(p, {}).get("value", 0),
                    "all_deals_count": adp.get(p, {}).get("count", 0),
                }
                for p in all_p
            },
            "by_vertical_product": {
                k: {
                    "funnel_value": fvp.get(k, {}).get("value", 0),
                    "funnel_count": fvp.get(k, {}).get("count", 0),
                    "closed_won_value": cvp.get(k, {}).get("value", 0),
                    "closed_won_count": cvp.get(k, {}).get("count", 0),
                    "first_entry_value": evp.get(k, {}).get("value", 0),
                    "first_entry_count": evp.get(k, {}).get("count", 0),
                    "all_deals_total": advp.get(k, {}).get("value", 0),
                    "all_deals_count": advp.get(k, {}).get("count", 0),
                }
                for k in all_vp
            },
        })

    # ---- "All" aggregate entry ----
    # Used by the frontend when quarter filter = "All"
    # closed_won: opps whose absolute latest stage is Closed Won
    sorted_all = df.sort_values(["history_date", "stage"], ascending=[True, True])
    latest_per_opp = sorted_all.groupby("Unique_ID").last().reset_index()
    abs_closed_won = latest_per_opp[latest_per_opp["stage"] == "Closed Won"]
    all_deals_global = latest_per_opp  # all opps, latest row, all stages

    # first_entry totals (sum across quarters)
    fe_total_value = sum(r["first_entry_value"] for r in results)
    fe_total_count = sum(r["first_entry_count"] for r in results)

    cw_value = int(abs_closed_won["Amount"].sum())
    cw_count = len(abs_closed_won)
    ad_total = int(all_deals_global["Amount"].sum())
    ad_count = len(all_deals_global)

    cwv, cwp, cwvp = build_breakdowns(abs_closed_won) if not abs_closed_won.empty else ({}, {}, {})
    adv, adp, advp = build_breakdowns(all_deals_global) if not all_deals_global.empty else ({}, {}, {})

    # For first_entry breakdowns in "All", sum across per-quarter breakdowns
    fe_by_v, fe_by_p, fe_by_vp = {}, {}, {}
    for r in results:
        for v, entry in r["by_vertical"].items():
            if v not in fe_by_v:
                fe_by_v[v] = {"value": 0, "count": 0}
            fe_by_v[v]["value"] += entry["first_entry_value"]
            fe_by_v[v]["count"] += entry["first_entry_count"]
        for p, entry in r["by_product"].items():
            if p not in fe_by_p:
                fe_by_p[p] = {"value": 0, "count": 0}
            fe_by_p[p]["value"] += entry["first_entry_value"]
            fe_by_p[p]["count"] += entry["first_entry_count"]
        for k, entry in r["by_vertical_product"].items():
            if k not in fe_by_vp:
                fe_by_vp[k] = {"value": 0, "count": 0}
            fe_by_vp[k]["value"] += entry["first_entry_value"]
            fe_by_vp[k]["count"] += entry["first_entry_count"]

    all_v = set(list(fe_by_v.keys()) + list(cwv.keys()) + list(adv.keys()))
    all_p = set(list(fe_by_p.keys()) + list(cwp.keys()) + list(adp.keys()))
    all_vp = set(list(fe_by_vp.keys()) + list(cwvp.keys()) + list(advp.keys()))

    results.append({
        "quarter": "All",
        "funnel_value": fe_total_value,   # for "All", funnel = first_entry total
        "funnel_count": fe_total_count,
        "closed_won_value": cw_value,
        "closed_won_count": cw_count,
        "first_entry_value": fe_total_value,
        "first_entry_count": fe_total_count,
        "all_deals_total": ad_total,
        "all_deals_count": ad_count,
        "conversion_rate": round(cw_value / fe_total_value * 100, 1) if fe_total_value else 0,
        "avg_deal_size": round(fe_total_value / fe_total_count) if fe_total_count else 0,
        "is_partial": False,
        "by_vertical": {
            v: {
                "funnel_value": fe_by_v.get(v, {}).get("value", 0),
                "funnel_count": fe_by_v.get(v, {}).get("count", 0),
                "closed_won_value": cwv.get(v, {}).get("value", 0),
                "closed_won_count": cwv.get(v, {}).get("count", 0),
                "first_entry_value": fe_by_v.get(v, {}).get("value", 0),
                "first_entry_count": fe_by_v.get(v, {}).get("count", 0),
                "all_deals_total": adv.get(v, {}).get("value", 0),
                "all_deals_count": adv.get(v, {}).get("count", 0),
            }
            for v in all_v
        },
        "by_product": {
            p: {
                "funnel_value": fe_by_p.get(p, {}).get("value", 0),
                "funnel_count": fe_by_p.get(p, {}).get("count", 0),
                "closed_won_value": cwp.get(p, {}).get("value", 0),
                "closed_won_count": cwp.get(p, {}).get("count", 0),
                "first_entry_value": fe_by_p.get(p, {}).get("value", 0),
                "first_entry_count": fe_by_p.get(p, {}).get("count", 0),
                "all_deals_total": adp.get(p, {}).get("value", 0),
                "all_deals_count": adp.get(p, {}).get("count", 0),
            }
            for p in all_p
        },
        "by_vertical_product": {
            k: {
                "funnel_value": fe_by_vp.get(k, {}).get("value", 0),
                "funnel_count": fe_by_vp.get(k, {}).get("count", 0),
                "closed_won_value": cwvp.get(k, {}).get("value", 0),
                "closed_won_count": cwvp.get(k, {}).get("count", 0),
                "first_entry_value": fe_by_vp.get(k, {}).get("value", 0),
                "first_entry_count": fe_by_vp.get(k, {}).get("count", 0),
                "all_deals_total": advp.get(k, {}).get("value", 0),
                "all_deals_count": advp.get(k, {}).get("count", 0),
            }
            for k in all_vp
        },
    })

    return results


def get_pipeline_snapshot_at(df: pd.DataFrame, cutoff: str | None = None) -> pd.DataFrame:
    """Pipeline state at a point in time, or latest state if no cutoff.

    For each opportunity, find its latest record up to the cutoff.
    Exclude opportunities whose latest state is Closed Lost.
    """
    if cutoff is not None:
        subset = df[df["history_date"] < pd.Timestamp(cutoff)]
    else:
        subset = df

    if subset.empty:
        return pd.DataFrame()

    sorted_df = subset.sort_values(["history_date", "stage"], ascending=[True, True])
    latest_per_opp = sorted_df.groupby("Unique_ID").last().reset_index()
    return latest_per_opp[latest_per_opp["stage"] != "Closed Lost"]


def build_stage_breakdown(df: pd.DataFrame) -> list[dict]:
    results = []
    for label, start, end in QUARTERS:
        snapshot = get_pipeline_snapshot_at(df, end)
        stages = {}
        if not snapshot.empty:
            for stage, grp in snapshot.groupby("stage"):
                bv, bp, _ = build_breakdowns(grp)
                stages[stage] = {
                    "value": int(grp["Amount"].sum()),
                    "count": len(grp),
                    "by_vertical": bv,
                    "by_product": bp,
                }
        results.append({"quarter": label, "stages": stages})

    # "All" — latest state of every opportunity
    snapshot = get_pipeline_snapshot_at(df)
    stages = {}
    if not snapshot.empty:
        for stage, grp in snapshot.groupby("stage"):
            bv, bp, _ = build_breakdowns(grp)
            stages[stage] = {
                "value": int(grp["Amount"].sum()),
                "count": len(grp),
                "by_vertical": bv,
                "by_product": bp,
            }
    results.append({"quarter": "All", "stages": stages})

    return results


def build_stage_flows(df: pd.DataFrame) -> list[dict]:
    """Build stage-to-stage transition data for the Sankey diagram.

    For each opportunity (ordered by history_date), generates:
      - Entry -> first_stage (where the deal first appeared)
      - prev_stage -> next_stage (for each subsequent stage change)

    Returns one entry per quarter + an "All" aggregate, each containing a list
    of links with value/count and by_vertical/by_product breakdowns.
    """
    sorted_df = df.sort_values(["Unique_ID", "history_date", "stage"], ascending=True)

    # Build list of individual transitions
    transitions = []
    for uid, group in sorted_df.groupby("Unique_ID"):
        rows = group.reset_index(drop=True)
        # First record: Entry -> first stage
        first = rows.iloc[0]
        transitions.append({
            "source": "Entry",
            "target": first["stage"],
            "Amount": first["Amount"],
            "Vertical": first["Vertical"],
            "OpportunityProductGroup": first["OpportunityProductGroup"],
            "history_date": first["history_date"],
        })
        # Subsequent stage changes
        prev_stage = first["stage"]
        for i in range(1, len(rows)):
            row = rows.iloc[i]
            if row["stage"] != prev_stage:
                transitions.append({
                    "source": prev_stage,
                    "target": row["stage"],
                    "Amount": row["Amount"],
                    "Vertical": row["Vertical"],
                    "OpportunityProductGroup": row["OpportunityProductGroup"],
                    "history_date": row["history_date"],
                })
                prev_stage = row["stage"]

    tdf = pd.DataFrame(transitions)
    tdf["history_date"] = pd.to_datetime(tdf["history_date"])

    def aggregate_links(subset: pd.DataFrame) -> list[dict]:
        links = []
        for (src, tgt), grp in subset.groupby(["source", "target"]):
            bv = {}
            for v, vgrp in grp.groupby("Vertical"):
                bv[v] = {"value": int(vgrp["Amount"].sum()), "count": len(vgrp)}
            bp = {}
            for p, pgrp in grp.groupby("OpportunityProductGroup"):
                bp[p] = {"value": int(pgrp["Amount"].sum()), "count": len(pgrp)}
            links.append({
                "source": src,
                "target": tgt,
                "value": int(grp["Amount"].sum()),
                "count": len(grp),
                "by_vertical": bv,
                "by_product": bp,
            })
        return links

    results = []
    for label, start, end in QUARTERS:
        start_ts, end_ts = pd.Timestamp(start), pd.Timestamp(end)
        in_quarter = tdf[(tdf["history_date"] >= start_ts) & (tdf["history_date"] < end_ts)]
        links = aggregate_links(in_quarter) if not in_quarter.empty else []
        results.append({"quarter": label, "links": links})

    # "All" aggregate
    results.append({"quarter": "All", "links": aggregate_links(tdf)})

    return results


def build_filter_options(df: pd.DataFrame) -> dict:
    return {
        "verticals": sorted(df["Vertical"].unique().tolist()),
        "products": sorted(df["OpportunityProductGroup"].unique().tolist()),
        "quarters": [q[0] for q in QUARTERS],
        "partial_quarters": sorted(PARTIAL_QUARTERS),
    }


def main():
    print("Loading data...")
    df = load_data()
    print(f"  {len(df)} rows, {df['Unique_ID'].nunique()} unique opportunities")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Building quarterly summary...")
    summary = build_quarterly_summary(df)
    with open(OUTPUT_DIR / "quarterly_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("Building stage breakdown...")
    stages = build_stage_breakdown(df)
    with open(OUTPUT_DIR / "stage_breakdown.json", "w") as f:
        json.dump(stages, f, indent=2)

    print("Building stage flows...")
    flows = build_stage_flows(df)
    with open(OUTPUT_DIR / "stage_flows.json", "w") as f:
        json.dump(flows, f, indent=2)

    print("Building filter options...")
    filters = build_filter_options(df)
    with open(OUTPUT_DIR / "filter_options.json", "w") as f:
        json.dump(filters, f, indent=2)

    print(f"Done! Files written to {OUTPUT_DIR}")
    for q in summary:
        if q["quarter"] == "All":
            print(f"  All: first_entry={q['first_entry_value']:>12,} ({q['first_entry_count']:>4} opps) "
                  f"won={q['closed_won_value']:>10,} ({q['closed_won_count']:>3} opps) "
                  f"avg_deal={q['all_deals_total'] // q['all_deals_count'] if q['all_deals_count'] else 0:>8,}")
        else:
            print(f"  {q['quarter']}: funnel={q['funnel_value']:>12,} ({q['funnel_count']:>4} opps) "
                  f"won={q['closed_won_value']:>10,} ({q['closed_won_count']:>3} opps) "
                  f"conv={q['conversion_rate']}%{' [partial]' if q['is_partial'] else ''}")


if __name__ == "__main__":
    main()
