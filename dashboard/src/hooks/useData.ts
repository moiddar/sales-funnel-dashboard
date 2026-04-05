import { useState, useEffect } from 'react';
import type { DashboardData, QuarterlySummary, StageBreakdown, StageFlows, FilterOptions } from '../types/data';

const BASE = import.meta.env.BASE_URL;

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
  return res.json();
}

export function useData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJSON<QuarterlySummary[]>('quarterly_summary.json'),
      fetchJSON<StageBreakdown[]>('stage_breakdown.json'),
      fetchJSON<StageFlows[]>('stage_flows.json'),
      fetchJSON<FilterOptions>('filter_options.json'),
    ])
      .then(([quarterlySummary, stageBreakdown, stageFlows, filterOptions]) => {
        setData({ quarterlySummary, stageBreakdown, stageFlows, filterOptions });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
