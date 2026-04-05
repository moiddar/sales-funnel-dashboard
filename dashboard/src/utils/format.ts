/** Convert "2024Q1" → "Q1 2024" */
export function formatQuarter(q: string): string {
  const match = q.match(/^(\d{4})Q(\d)$/);
  if (!match) return q;
  return `Q${match[2]} ${match[1]}`;
}

export function formatGBP(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}K`;
  return `£${value}`;
}
