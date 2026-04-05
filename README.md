# Sales Funnel Dashboard
<img width="1544" height="938" alt="preview" src="https://github.com/user-attachments/assets/2fe2e631-5937-4f6d-9c7b-e02578d9b744" />

# [Dashboard Link](https://moiddar.github.io/sales-funnel-dashboard/)   

Analyses `raw_data.xlsx` (opportunity changelog) to compare beginning-of-quarter pipeline value vs closed-won value, displayed in an interactive dashboard.

## Data

`raw_data.xlsx` — 7,530 rows, 1,798 unique opportunities. Each row is a changelog entry when stage or close_date changed.

Columns: `Unique_ID`, `Amount` (GBP, integer), `history_date` (datetime), `OpportunityProductGroup` (Prod_001–004), `Vertical` (Business/Education/Government), `stage`, `close_date`

Stages: Discovery, Meeting and Presentation, Proposal Delivery, Negotiating, Waiting on Signature, Closed Won, Closed Lost

Meaningful data range: 2024Q1–2026Q1. 2026Q1 is partial (data ends 2026-03-05).

## Architecture

- **Data pipeline:** `scripts/build_data.py` — Python (pandas + openpyxl) reads `raw_data.xlsx`, outputs static JSON to `dashboard/public/data/`
- **Frontend:** `dashboard/` — React + TypeScript, Vite, Tailwind CSS v4, Recharts + custom SVG Sankey
- **Hosting:** GitHub Pages (static site, no backend). Vite `base` set to `/sales-funnel-dashboard/`
- **Python:** virtual environment at `venv/`, deps in `requirements.txt`

## Project Structure

```
scripts/build_data.py              # Data pipeline: xlsx -> JSON
dashboard/
  public/data/                     # Generated JSON (gitignored, rebuilt by pipeline)
    quarterly_summary.json         # Per-quarter + "All" aggregate with breakdowns
    stage_breakdown.json           # End-of-quarter pipeline state by stage + "All" entry
    stage_flows.json               # Stage-to-stage transition links per quarter + "All" (Sankey data)
    filter_options.json            # Dropdown metadata
  src/
    App.tsx                        # Root layout, wires data + filters to components
    types/data.ts                  # TypeScript interfaces for JSON shapes
    hooks/useData.ts               # Fetches all JSON on mount
    hooks/useFilters.ts            # Filter state, KPI computation, client-side aggregation
    components/
      Header.tsx
      FilterBar.tsx                # Vertical, product, quarter dropdown filters
      KPIBar.tsx                   # 4 summary KPI cards (accepts KPIValues)
      InfoTooltip.tsx              # Hover/click popover explaining metric definitions
      StorySection.tsx             # Section wrapper with heading + description
      InsightsSection.tsx          # Dynamic actionable insights derived from FilteredData
      charts/
        FunnelVsClosedChart.tsx    # ComposedChart: bars + conversion line (dual Y-axis)
        FunnelChart.tsx            # Horizontal funnel visual: pipeline by stage
        SankeyChart.tsx            # Custom SVG Sankey: stage-to-stage deal flow with hover highlighting
        ComparisonBarChart.tsx     # Grouped bar chart: pipeline in vs closed won (reused for vertical & product)
    utils/
      format.ts                    # formatQuarter, formatGBP helpers
  vite.config.ts                   # Vite + React + Tailwind plugins
```

## Metrics & Analysis Logic

All metrics are computed in `scripts/build_data.py` and output as static JSON. The frontend never re-derives metrics from raw data — it selects the appropriate pre-computed values based on whether the quarter filter is "All" or a specific quarter.

### Deduplication (preprocessing)

The raw data contains multiple changelog rows per opportunity. Before any analysis, we deduplicate on (Unique_ID, Amount, Product, Vertical, stage), keeping the most recent `history_date` per combination. This collapses duplicate stage entries while preserving the full stage progression for each opportunity.

### KPI: "What entered the pipeline?" (dual-mode)

**All quarters** → `first_entry_value`: For each opportunity, find its chronologically first record. If that first record's stage is terminal (Closed Won or Closed Lost), exclude the opportunity entirely. Sum the amounts of remaining opportunities. Each opportunity is counted exactly once, in the quarter its first record falls in. Pre-range entries are assigned to 2024Q1.

**Specific quarter** → `funnel_value`: Start-of-quarter pipeline snapshot. For each opportunity, find its most recent record before the quarter start. If that state is non-terminal, include it. Sum the amounts.

Note: `funnel_value` can double-count opportunities across quarters (a deal open for 3 quarters appears in each). `first_entry_value` is deduplicated. The frontend uses the right one based on context.

### KPI: "What did we actually close?" (dual-mode)

**All quarters** → Pre-computed in the "All" aggregate entry: opportunities whose absolute latest stage across all time is Closed Won. Handles reopened deals correctly (1 known case: OPP-27025976 went from Closed Won back to Meeting and Presentation).

**Specific quarter** → `closed_won_value`: Filter records to within the quarter. For each opportunity, take its latest record within the quarter. If that latest stage is Closed Won, include it. This means a deal that closes and reopens within the same quarter is NOT counted as closed.

### KPI: "Typical deal worth?" (`all_deals_total` / `all_deals_count`)

Average amount across ALL unique_ids using each opportunity's latest row, regardless of stage.

**All quarters** → Uses the "All" aggregate's `all_deals_total / all_deals_count` (all 1,798 opps).

**Specific quarter** → Same computation but only for records with `history_date` before the quarter end.

### Conversion rate (`conversion_rate`)

`closed_won_value / funnel_value * 100` per quarter. The KPI card computes `closedWon / pipelineEntered` where those values differ between "All" and specific-quarter modes (see above).

### Stage breakdown (funnel chart)

The funnel chart shows the current state of the pipeline — each opportunity's latest stage, excluding Closed Lost. For a specific quarter, it shows the pipeline at the end of that quarter. For "All", it uses every opportunity's absolute latest stage. The `stage_breakdown.json` includes one entry per quarter plus a special "All" entry. The frontend selects the matching entry rather than summing across quarters.

Note: For "All", the funnel chart total (£27.4M, 435 opps) differs from the pipeline KPI (£121.8M, 1,760 opps) because the funnel excludes 1,337 opportunities that ended up Closed Lost. The funnel's Closed Won value does match the KPI.

### Stage flows (Sankey chart)

`stage_flows.json` contains per-quarter and "All" entries, each with an array of `links`. Each link records the transition from one stage to another: `{ source, target, value, count, by_vertical, by_product }`. `build_stage_flows()` in `build_data.py` computes these by looking at consecutive stage changes per opportunity within each quarter. The "Entry" pseudo-stage represents an opportunity's first appearance. Links include breakdown fields so the frontend can filter by vertical/product without recomputation.

### Breakdowns

All metrics include nested breakdowns by `by_vertical`, `by_product`, and `by_vertical_product` (cross-tab). This allows the frontend to filter by vertical and/or product group without re-processing raw data — it simply sums the matching breakdown entries.

### "All" aggregate in quarterly_summary.json

`quarterly_summary.json` contains 9 per-quarter entries plus one `"quarter": "All"` aggregate. The "All" entry has pre-computed values that can't be derived by summing per-quarter values (e.g., `closed_won_value` based on absolute latest stage, `all_deals_total/count` for global average). The frontend's `useFilters` hook separates the "All" entry from per-quarter entries and uses it for KPI computation when the quarter filter is "All".

## Frontend Data Flow

`useFilters` returns `FilteredData` with six parts:
- `kpiValues: KPIValues` — pre-computed KPI values using the correct metric per filter mode
- `chartSummary: QuarterlySummary[]` — per-quarter entries for the bar chart (never includes the "All" aggregate)
- `stages: StageBreakdown[]` — for the funnel chart
- `flows: FlowLink[]` — stage-to-stage transitions for the Sankey chart
- `verticalComparison: ComparisonEntry[]` — pipeline in vs closed won per vertical
- `productComparison: ComparisonEntry[]` — pipeline in vs closed won per product

`KPIBar` receives `KPIValues` directly (not raw summary data). `FunnelVsClosedChart` receives `chartSummary`. `FunnelChart` receives `stages`. `SankeyChart` receives `flows`. `ComparisonBarChart` is rendered twice — once with `verticalComparison`, once with `productComparison`.

The comparison data uses the same dual-mode logic: `first_entry_value` for "All" quarters, `funnel_value` for a specific quarter. When vertical/product filters are active, it uses the `by_vertical_product` cross-tab to compute filtered totals.

`InsightsSection` receives the full `FilteredData` and `FilterState`. It contains a client-side insight engine (`generateInsights`) that derives up to 6 prioritised insights: stage bottleneck, best/worst vertical, best/worst product, pipeline concentration risk, and conversion trend (All mode only). Insights adapt to filters — comparisons are suppressed when fewer than 2 items are visible. Each insight has a sentiment (positive/negative/warning/neutral) that drives its icon and border color.
