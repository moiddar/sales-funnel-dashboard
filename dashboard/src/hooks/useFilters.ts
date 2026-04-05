import { useState, useMemo, useCallback } from 'react';
import type { DashboardData, FilterState, QuarterlySummary, StageBreakdown, FlowLink, KPIValues, BreakdownEntry, ComparisonEntry } from '../types/data';

export interface FilteredData {
  /** Per-quarter entries filtered by selected quarter (excludes the "All" aggregate) */
  chartSummary: QuarterlySummary[];
  /** All per-quarter entries regardless of quarter filter (for pipeline vs closed chart) */
  allQuartersSummary: QuarterlySummary[];
  /** Pre-computed KPI values respecting the All vs specific-quarter logic */
  kpiValues: KPIValues;
  stages: StageBreakdown[];
  flows: FlowLink[];
  verticalComparison: ComparisonEntry[];
  productComparison: ComparisonEntry[];
}

export function useFilters(data: DashboardData | null) {
  const [filters, setFilters] = useState<FilterState>({
    verticals: [],
    products: [],
    quarter: 'All',
  });

  const setVerticals = useCallback((v: string[]) => {
    setFilters((f) => ({ ...f, verticals: v }));
  }, []);

  const setProducts = useCallback((p: string[]) => {
    setFilters((f) => ({ ...f, products: p }));
  }, []);

  const setQuarter = useCallback((q: string) => {
    setFilters((f) => ({ ...f, quarter: q }));
  }, []);

  const filtered = useMemo<FilteredData | null>(() => {
    if (!data) return null;

    const hasVerticalFilter = filters.verticals.length > 0;
    const hasProductFilter = filters.products.length > 0;
    const needsFilter = hasVerticalFilter || hasProductFilter;
    const isAllQuarters = filters.quarter === 'All';

    // Separate per-quarter entries from the "All" aggregate
    const perQuarterSummary = data.quarterlySummary.filter((q) => q.quarter !== 'All');
    const allAggregate = data.quarterlySummary.find((q) => q.quarter === 'All')!;

    // Chart data: per-quarter entries, filtered by selected quarter
    const chartQuarters = isAllQuarters
      ? perQuarterSummary
      : perQuarterSummary.filter((q) => q.quarter === filters.quarter);

    // Stage breakdown
    const slicedStages = isAllQuarters
      ? data.stageBreakdown.filter((q) => q.quarter === 'All')
      : data.stageBreakdown.filter((q) => q.quarter === filters.quarter);

    // Stage flows — select matching quarter
    const flowEntry = isAllQuarters
      ? data.stageFlows.find((f) => f.quarter === 'All')
      : data.stageFlows.find((f) => f.quarter === filters.quarter);
    const rawFlows = flowEntry?.links ?? [];

    if (!needsFilter) {
      // No vertical/product filter — compute KPIs directly
      const kpiValues = computeKPIs(isAllQuarters, chartQuarters, allAggregate);
      const source = isAllQuarters ? allAggregate : chartQuarters[0];
      const { verticalComparison, productComparison } = source
        ? computeComparisons(source, isAllQuarters, filters)
        : { verticalComparison: [], productComparison: [] };
      return {
        chartSummary: chartQuarters,
        allQuartersSummary: perQuarterSummary,
        kpiValues,
        stages: slicedStages,
        flows: rawFlows,
        verticalComparison,
        productComparison,
      };
    }

    // Apply vertical/product filters to chart quarters
    const filteredChartQuarters = chartQuarters.map((q) => applyVPFilter(q, filters));

    // Apply vertical/product filters to all per-quarter entries (for pipeline vs closed chart)
    const filteredAllQuarters = perQuarterSummary.map((q) => applyVPFilter(q, filters));

    // Apply filter to the "All" aggregate
    const filteredAllAggregate = applyVPFilter(allAggregate, filters);

    // Apply filter to stage breakdown
    const filteredStages = slicedStages.map((q) => {
      const filteredStageEntries: Record<string, typeof q.stages[string]> = {};
      for (const [stage, stageData] of Object.entries(q.stages)) {
        let value = 0, count = 0;

        if (hasVerticalFilter && hasProductFilter) {
          // No cross-tab available in stage data, approximate via min
          for (const [v, vData] of Object.entries(stageData.by_vertical)) {
            if (filters.verticals.includes(v)) {
              value += vData.value;
              count += vData.count;
            }
          }
          let productValue = 0, productCount = 0;
          for (const [p, pData] of Object.entries(stageData.by_product)) {
            if (filters.products.includes(p)) {
              productValue += pData.value;
              productCount += pData.count;
            }
          }
          value = Math.min(value, productValue);
          count = Math.min(count, productCount);
        } else if (hasVerticalFilter) {
          for (const [v, vData] of Object.entries(stageData.by_vertical)) {
            if (filters.verticals.includes(v)) {
              value += vData.value;
              count += vData.count;
            }
          }
        } else if (hasProductFilter) {
          for (const [p, pData] of Object.entries(stageData.by_product)) {
            if (filters.products.includes(p)) {
              value += pData.value;
              count += pData.count;
            }
          }
        }

        if (count > 0) {
          filteredStageEntries[stage] = { ...stageData, value, count };
        }
      }
      return { ...q, stages: filteredStageEntries };
    });

    // Apply filter to stage flows
    const filteredFlows = rawFlows
      .map((link) => {
        let value = 0, count = 0;
        if (hasVerticalFilter && hasProductFilter) {
          for (const [v, vData] of Object.entries(link.by_vertical)) {
            if (filters.verticals.includes(v)) { value += vData.value; count += vData.count; }
          }
          let pv = 0, pc = 0;
          for (const [p, pData] of Object.entries(link.by_product)) {
            if (filters.products.includes(p)) { pv += pData.value; pc += pData.count; }
          }
          value = Math.min(value, pv);
          count = Math.min(count, pc);
        } else if (hasVerticalFilter) {
          for (const [v, vData] of Object.entries(link.by_vertical)) {
            if (filters.verticals.includes(v)) { value += vData.value; count += vData.count; }
          }
        } else {
          for (const [p, pData] of Object.entries(link.by_product)) {
            if (filters.products.includes(p)) { value += pData.value; count += pData.count; }
          }
        }
        return count > 0 ? { ...link, value, count } : null;
      })
      .filter((l): l is FlowLink => l !== null);

    const kpiValues = computeKPIs(isAllQuarters, filteredChartQuarters, filteredAllAggregate);

    const comparisonSource = isAllQuarters ? filteredAllAggregate : filteredChartQuarters[0];
    const { verticalComparison, productComparison } = comparisonSource
      ? computeComparisons(comparisonSource, isAllQuarters, filters)
      : { verticalComparison: [], productComparison: [] };

    return {
      chartSummary: filteredChartQuarters,
      allQuartersSummary: filteredAllQuarters,
      kpiValues,
      stages: filteredStages,
      flows: filteredFlows,
      verticalComparison,
      productComparison,
    };
  }, [data, filters]);

  return { filters, filtered, setVerticals, setProducts, setQuarter };
}

/**
 * Apply vertical/product filter to a QuarterlySummary using the cross-tab breakdowns.
 */
function applyVPFilter(q: QuarterlySummary, filters: FilterState): QuarterlySummary {
  const matchingKeys = getMatchingKeys(
    q.by_vertical_product,
    filters.verticals,
    filters.products,
  );

  let funnelValue = 0, funnelCount = 0, closedValue = 0, closedCount = 0;
  let firstEntryValue = 0, firstEntryCount = 0;
  let allDealsTotal = 0, allDealsCount = 0;
  for (const key of matchingKeys) {
    const entry = q.by_vertical_product[key];
    if (entry) {
      funnelValue += entry.funnel_value;
      funnelCount += entry.funnel_count;
      closedValue += entry.closed_won_value;
      closedCount += entry.closed_won_count;
      firstEntryValue += entry.first_entry_value;
      firstEntryCount += entry.first_entry_count;
      allDealsTotal += entry.all_deals_total;
      allDealsCount += entry.all_deals_count;
    }
  }

  return {
    ...q,
    funnel_value: funnelValue,
    funnel_count: funnelCount,
    closed_won_value: closedValue,
    closed_won_count: closedCount,
    first_entry_value: firstEntryValue,
    first_entry_count: firstEntryCount,
    all_deals_total: allDealsTotal,
    all_deals_count: allDealsCount,
    conversion_rate: funnelValue > 0 ? Math.round(closedValue / funnelValue * 1000) / 10 : 0,
    avg_deal_size: funnelCount > 0 ? Math.round(funnelValue / funnelCount) : 0,
  };
}

/**
 * Compute the 4 KPI values based on whether we're in "All" or specific-quarter mode.
 *
 * "What entered the pipeline?":
 *   All → sum of first_entry_value across quarters (deduplicated)
 *   Quarter → funnel_value (start-of-quarter pipeline snapshot)
 *
 * "What did we actually close?":
 *   All → closed_won_value from the "All" aggregate (latest stage == Closed Won)
 *   Quarter → closed_won_value for that quarter (latest stage within quarter)
 *
 * "How much pipeline converted?":
 *   closedWon / pipelineEntered
 *
 * "Typical deal worth?":
 *   All → all_deals_total / all_deals_count from the "All" aggregate
 *   Quarter → all_deals_total / all_deals_count for that quarter
 */
function computeKPIs(
  isAllQuarters: boolean,
  chartQuarters: QuarterlySummary[],
  allAggregate: QuarterlySummary,
): KPIValues {
  let pipelineEntered: number;
  let pipelineEnteredCount: number;
  let closedWon: number;
  let closedWonCount: number;
  let avgDealSize: number;

  if (isAllQuarters) {
    // "All" mode: use the pre-computed aggregate
    pipelineEntered = allAggregate.first_entry_value;
    pipelineEnteredCount = allAggregate.first_entry_count;
    closedWon = allAggregate.closed_won_value;
    closedWonCount = allAggregate.closed_won_count;
    avgDealSize = allAggregate.all_deals_count > 0
      ? Math.round(allAggregate.all_deals_total / allAggregate.all_deals_count)
      : 0;
  } else {
    // Specific quarter mode
    const q = chartQuarters[0];
    if (!q) {
      return { pipelineEntered: 0, pipelineEnteredCount: 0, closedWon: 0, closedWonCount: 0, conversionRate: 0, avgDealSize: 0 };
    }
    pipelineEntered = q.funnel_value;
    pipelineEnteredCount = q.funnel_count;
    closedWon = q.closed_won_value;
    closedWonCount = q.closed_won_count;
    avgDealSize = q.all_deals_count > 0
      ? Math.round(q.all_deals_total / q.all_deals_count)
      : 0;
  }

  const conversionRate = pipelineEntered > 0
    ? Math.round((closedWon / pipelineEntered) * 1000) / 10
    : 0;

  return { pipelineEntered, pipelineEnteredCount, closedWon, closedWonCount, conversionRate, avgDealSize };
}

function computeComparisons(
  source: QuarterlySummary,
  isAllQuarters: boolean,
  filters: FilterState,
): { verticalComparison: ComparisonEntry[]; productComparison: ComparisonEntry[] } {
  const hasVerticalFilter = filters.verticals.length > 0;
  const hasProductFilter = filters.products.length > 0;

  const getPipelineIn = (e: BreakdownEntry) =>
    isAllQuarters ? e.first_entry_value : e.funnel_value;

  // Per-vertical totals
  const verticalMap: Record<string, { pipelineIn: number; closedWon: number }> = {};
  if (hasProductFilter) {
    for (const [key, entry] of Object.entries(source.by_vertical_product)) {
      const [v, p] = key.split('|');
      if (!filters.products.includes(p)) continue;
      if (hasVerticalFilter && !filters.verticals.includes(v)) continue;
      if (!verticalMap[v]) verticalMap[v] = { pipelineIn: 0, closedWon: 0 };
      verticalMap[v].pipelineIn += getPipelineIn(entry);
      verticalMap[v].closedWon += entry.closed_won_value;
    }
  } else {
    for (const [v, entry] of Object.entries(source.by_vertical)) {
      if (hasVerticalFilter && !filters.verticals.includes(v)) continue;
      verticalMap[v] = { pipelineIn: getPipelineIn(entry), closedWon: entry.closed_won_value };
    }
  }

  // Per-product totals
  const productMap: Record<string, { pipelineIn: number; closedWon: number }> = {};
  if (hasVerticalFilter) {
    for (const [key, entry] of Object.entries(source.by_vertical_product)) {
      const [v, p] = key.split('|');
      if (!filters.verticals.includes(v)) continue;
      if (hasProductFilter && !filters.products.includes(p)) continue;
      if (!productMap[p]) productMap[p] = { pipelineIn: 0, closedWon: 0 };
      productMap[p].pipelineIn += getPipelineIn(entry);
      productMap[p].closedWon += entry.closed_won_value;
    }
  } else {
    for (const [p, entry] of Object.entries(source.by_product)) {
      if (hasProductFilter && !filters.products.includes(p)) continue;
      productMap[p] = { pipelineIn: getPipelineIn(entry), closedWon: entry.closed_won_value };
    }
  }

  const toConversion = (vals: { pipelineIn: number; closedWon: number }) =>
    vals.pipelineIn > 0 ? Math.round((vals.closedWon / vals.pipelineIn) * 1000) / 10 : 0;

  const verticalComparison = Object.entries(verticalMap)
    .map(([name, vals]) => ({ name, ...vals, conversionRate: toConversion(vals) }))
    .sort((a, b) => b.pipelineIn - a.pipelineIn);

  const productComparison = Object.entries(productMap)
    .map(([name, vals]) => ({ name, ...vals, conversionRate: toConversion(vals) }))
    .sort((a, b) => b.pipelineIn - a.pipelineIn);

  return { verticalComparison, productComparison };
}

function getMatchingKeys(
  vpMap: Record<string, unknown>,
  verticals: string[],
  products: string[]
): string[] {
  const hasV = verticals.length > 0;
  const hasP = products.length > 0;

  return Object.keys(vpMap).filter((key) => {
    const [v, p] = key.split('|');
    const vMatch = !hasV || verticals.includes(v);
    const pMatch = !hasP || products.includes(p);
    return vMatch && pMatch;
  });
}
