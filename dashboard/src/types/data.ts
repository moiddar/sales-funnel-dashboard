export interface BreakdownEntry {
  funnel_value: number;
  funnel_count: number;
  closed_won_value: number;
  closed_won_count: number;
  first_entry_value: number;
  first_entry_count: number;
  all_deals_total: number;
  all_deals_count: number;
}

export interface QuarterlySummary {
  quarter: string;
  funnel_value: number;
  funnel_count: number;
  closed_won_value: number;
  closed_won_count: number;
  first_entry_value: number;
  first_entry_count: number;
  all_deals_total: number;
  all_deals_count: number;
  conversion_rate: number;
  avg_deal_size: number;
  is_partial: boolean;
  by_vertical: Record<string, BreakdownEntry>;
  by_product: Record<string, BreakdownEntry>;
  by_vertical_product: Record<string, BreakdownEntry>;
}

export interface StageData {
  value: number;
  count: number;
  by_vertical: Record<string, { value: number; count: number }>;
  by_product: Record<string, { value: number; count: number }>;
}

export interface StageBreakdown {
  quarter: string;
  stages: Record<string, StageData>;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  count: number;
  by_vertical: Record<string, { value: number; count: number }>;
  by_product: Record<string, { value: number; count: number }>;
}

export interface StageFlows {
  quarter: string;
  links: FlowLink[];
}

export interface FilterOptions {
  verticals: string[];
  products: string[];
  quarters: string[];
  partial_quarters: string[];
}

export interface KPIValues {
  pipelineEntered: number;
  pipelineEnteredCount: number;
  closedWon: number;
  closedWonCount: number;
  conversionRate: number;
  avgDealSize: number;
}

export interface DashboardData {
  quarterlySummary: QuarterlySummary[];
  stageBreakdown: StageBreakdown[];
  stageFlows: StageFlows[];
  filterOptions: FilterOptions;
}

export interface ComparisonEntry {
  name: string;
  pipelineIn: number;
  closedWon: number;
  conversionRate: number;
}

export interface FilterState {
  verticals: string[];
  products: string[];
  quarter: string; // "All" or a specific quarter like "2024Q1"
}
