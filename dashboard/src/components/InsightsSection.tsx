import { useMemo } from 'react';
import type { FilteredData } from '../hooks/useFilters';
import type { FilterState } from '../types/data';
import { formatGBP, formatQuarter } from '../utils/format';

type InsightSentiment = 'positive' | 'negative' | 'neutral' | 'warning';

interface Insight {
  id: string;
  sentiment: InsightSentiment;
  title: string;
  description: string;
  priority: number;
}

interface InsightsSectionProps {
  data: FilteredData;
  filters: FilterState;
}

// --- SVG Icons ---

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-emerald-600 shrink-0">
      <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-accent shrink-0">
      <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-accent shrink-0">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-brand/50 shrink-0">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  );
}

const SENTIMENT_ICON: Record<InsightSentiment, React.FC> = {
  positive: ArrowUpIcon,
  negative: ArrowDownIcon,
  warning: WarningIcon,
  neutral: InfoIcon,
};

const SENTIMENT_BORDER: Record<InsightSentiment, string> = {
  positive: 'border-l-emerald-500',
  negative: 'border-l-accent',
  warning: 'border-l-accent',
  neutral: 'border-l-brand/30',
};

// --- Stage advice ---

const STAGE_ADVICE: Record<string, string> = {
  'Discovery': 'Focus on faster qualification to move deals forward.',
  'Meeting and Presentation': 'Ensure meetings lead to clear next steps and proposals.',
  'Proposal Delivery': 'Review proposal turnaround times and follow-up cadence.',
  'Negotiating': 'Assess whether pricing or terms are causing stalls.',
  'Waiting on Signature': 'Follow up on pending signatures to accelerate close.',
};

// --- Insight generators ---

function generateInsights(data: FilteredData, filters: FilterState): Insight[] {
  const insights: Insight[] = [];
  const isAll = filters.quarter === 'All';
  const quarterLabel = isAll ? 'overall' : `in ${formatQuarter(filters.quarter)}`;

  // 1. Stage Bottleneck
  if (data.stages.length > 0) {
    const stageMap = data.stages[0].stages;
    const nonTerminal = Object.entries(stageMap).filter(
      ([name]) => name !== 'Closed Won' && name !== 'Closed Lost',
    );
    if (nonTerminal.length >= 2) {
      const totalValue = nonTerminal.reduce((sum, [, s]) => sum + s.value, 0);
      const sorted = [...nonTerminal].sort((a, b) => b[1].value - a[1].value);
      const [topStage, topData] = sorted[0];
      const pct = totalValue > 0 ? Math.round((topData.value / totalValue) * 100) : 0;
      const advice = STAGE_ADVICE[topStage] || 'Investigate what is slowing progression.';
      insights.push({
        id: 'stage-bottleneck',
        sentiment: 'warning',
        title: `Bottleneck: ${topStage}`,
        description: `${formatGBP(topData.value)} (${pct}% of active pipeline) is sitting in ${topStage} across ${topData.count} deals. ${advice}`,
        priority: 1,
      });
    }
  }

  // 2 & 3. Best / Worst Vertical
  if (data.verticalComparison.length >= 2) {
    const withPipeline = data.verticalComparison.filter((v) => v.pipelineIn > 0);
    if (withPipeline.length >= 2) {
      const sorted = [...withPipeline].sort((a, b) => b.conversionRate - a.conversionRate);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      if (best.conversionRate > worst.conversionRate) {
        insights.push({
          id: 'best-vertical',
          sentiment: 'positive',
          title: `Top Vertical: ${best.name}`,
          description: `${best.name} converts at ${best.conversionRate.toFixed(1)}% ${quarterLabel}, closing ${formatGBP(best.closedWon)} from ${formatGBP(best.pipelineIn)} pipeline. Consider allocating more resources here.`,
          priority: 2,
        });
        insights.push({
          id: 'worst-vertical',
          sentiment: 'negative',
          title: `Underperforming: ${worst.name}`,
          description: `${worst.name} converts at just ${worst.conversionRate.toFixed(1)}% ${quarterLabel} despite ${formatGBP(worst.pipelineIn)} in pipeline. Investigate deal quality or sales process for this segment.`,
          priority: 3,
        });
      }
    }
  }

  // 4 & 5. Best / Worst Product
  if (data.productComparison.length >= 2) {
    const withPipeline = data.productComparison.filter((p) => p.pipelineIn > 0);
    const zeroPipeline = data.productComparison.filter((p) => p.pipelineIn === 0 && p.closedWon === 0);

    if (withPipeline.length >= 2) {
      const sorted = [...withPipeline].sort((a, b) => b.conversionRate - a.conversionRate);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      if (best.conversionRate > worst.conversionRate) {
        insights.push({
          id: 'best-product',
          sentiment: 'positive',
          title: `Top Product: ${best.name}`,
          description: `${best.name} converts at ${best.conversionRate.toFixed(1)}% ${quarterLabel}, closing ${formatGBP(best.closedWon)}. This is the strongest performer in the portfolio.`,
          priority: 2,
        });
        insights.push({
          id: 'worst-product',
          sentiment: 'negative',
          title: `Underperforming: ${worst.name}`,
          description: `${worst.name} converts at ${worst.conversionRate.toFixed(1)}% ${quarterLabel} with ${formatGBP(worst.pipelineIn)} in pipeline. Review whether positioning or targeting needs adjustment.`,
          priority: 3,
        });
      }
    } else if (withPipeline.length === 1 && zeroPipeline.length > 0) {
      // Only one product has pipeline, but others have zero — flag the zero ones
      insights.push({
        id: 'worst-product',
        sentiment: 'warning',
        title: `No Activity: ${zeroPipeline.map((p) => p.name).join(', ')}`,
        description: `${zeroPipeline.length === 1 ? 'This product has' : 'These products have'} generated no pipeline or closed-won value ${quarterLabel}. Assess whether they need investment or should be deprioritised.`,
        priority: 4,
      });
    }
  }

  // 6. Pipeline Concentration
  if (data.verticalComparison.length >= 2) {
    const totalPipeline = data.verticalComparison.reduce((sum, v) => sum + v.pipelineIn, 0);
    if (totalPipeline > 0) {
      for (const v of data.verticalComparison) {
        const share = v.pipelineIn / totalPipeline;
        if (share > 0.55) {
          const level = share > 0.7 ? 'High' : 'Moderate';
          insights.push({
            id: 'concentration-vertical',
            sentiment: 'warning',
            title: `${level} Concentration: ${v.name}`,
            description: `${Math.round(share * 100)}% of pipeline value comes from ${v.name}. This creates risk if the vertical underperforms — consider diversifying pipeline sources.`,
            priority: 4,
          });
          break;
        }
      }
    }
  }

  // 7. Conversion Trend (All mode only)
  if (isAll && data.allQuartersSummary.length >= 3) {
    const quarters = [...data.allQuartersSummary].sort((a, b) =>
      a.quarter.localeCompare(b.quarter),
    );
    const recent = quarters.slice(-3);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const diff = last.conversion_rate - first.conversion_rate;
    const partialNote = last.is_partial ? ' (partial quarter)' : '';

    if (Math.abs(diff) > 1) {
      if (diff < 0) {
        insights.push({
          id: 'conversion-trend',
          sentiment: 'negative',
          title: 'Conversion Declining',
          description: `Conversion rate dropped from ${first.conversion_rate.toFixed(1)}% (${formatQuarter(first.quarter)}) to ${last.conversion_rate.toFixed(1)}% (${formatQuarter(last.quarter)}${partialNote}), a decline of ${Math.abs(diff).toFixed(1)} percentage points over 3 quarters.`,
          priority: 1,
        });
      } else {
        insights.push({
          id: 'conversion-trend',
          sentiment: 'positive',
          title: 'Conversion Improving',
          description: `Conversion rate improved from ${first.conversion_rate.toFixed(1)}% (${formatQuarter(first.quarter)}) to ${last.conversion_rate.toFixed(1)}% (${formatQuarter(last.quarter)}${partialNote}), gaining ${diff.toFixed(1)} percentage points over 3 quarters.`,
          priority: 2,
        });
      }
    }
  }

  // Sort by priority (lower = higher priority), take top 6
  insights.sort((a, b) => a.priority - b.priority);
  return insights.slice(0, 6);
}

// --- Component ---

export function InsightsSection({ data, filters }: InsightsSectionProps) {
  const insights = useMemo(() => generateInsights(data, filters), [data, filters]);

  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {insights.map((insight) => {
        const Icon = SENTIMENT_ICON[insight.sentiment];
        const borderClass = SENTIMENT_BORDER[insight.sentiment];
        return (
          <div
            key={insight.id}
            className={`bg-white rounded-xl border border-brand/15 border-l-3 ${borderClass} p-4`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon />
              <p className="text-sm font-semibold text-brand">{insight.title}</p>
            </div>
            <p className="text-sm text-brand/60 leading-relaxed">{insight.description}</p>
          </div>
        );
      })}
    </div>
  );
}
