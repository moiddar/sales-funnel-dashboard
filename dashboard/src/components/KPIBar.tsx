import { InfoTooltip } from './InfoTooltip';
import type { KPIValues } from '../types/data';
import { formatGBP } from '../utils/format';

interface KPIBarProps {
  data: KPIValues;
  isAllQuarters: boolean;
}

const TOOLTIPS_ALL: Record<string, { definition: string; why: string }> = {
  'What entered the pipeline?': {
    definition: 'Sum of each opportunity\'s amount at its first appearance in the data, excluding deals that were already terminal (Closed Won/Lost). Each deal is counted once, in the quarter it first appeared.',
    why: 'Shows the total new potential revenue that entered the sales process — the starting pool we had to work with.',
  },
  'What did we actually close?': {
    definition: 'Total value of opportunities whose absolute latest stage across all time is Closed Won. Handles reopened deals correctly — if a deal went back to an earlier stage, it\'s not counted.',
    why: 'The bottom line: how much revenue we actually won from all the pipeline we generated.',
  },
  'How much pipeline converted?': {
    definition: 'Closed Won value divided by Pipeline Entered value, as a percentage.',
    why: 'Measures overall sales efficiency — what fraction of potential revenue turned into actual revenue.',
  },
  'What was a typical deal worth?': {
    definition: 'Average amount across all unique opportunities using each opportunity\'s latest record, regardless of stage (including lost deals).',
    why: 'Helps calibrate deal-size expectations and spot shifts in the mix of opportunities over time.',
  },
};

const TOOLTIPS_QUARTER: Record<string, { definition: string; why: string }> = {
  'What entered the pipeline?': {
    definition: 'Start-of-quarter pipeline snapshot: total value of all opportunities that were in a non-terminal stage at the beginning of this quarter. A deal open for multiple quarters appears in each.',
    why: 'Shows how much pipeline was available to work at the start of this quarter — the addressable opportunity.',
  },
  'What did we actually close?': {
    definition: 'Opportunities whose latest record within this quarter has stage "Closed Won". A deal that closes and reopens within the same quarter is not counted.',
    why: 'Tracks the revenue we locked in during this specific quarter.',
  },
  'How much pipeline converted?': {
    definition: 'Closed Won value divided by the start-of-quarter pipeline value, as a percentage.',
    why: 'Shows this quarter\'s conversion efficiency — how effectively we turned available pipeline into wins.',
  },
  'What was a typical deal worth?': {
    definition: 'Average amount across all unique opportunities with a record before the end of this quarter, using each opportunity\'s latest row.',
    why: 'Helps spot quarter-over-quarter shifts in deal size and mix.',
  },
};

export function KPIBar({ data, isAllQuarters }: KPIBarProps) {
  const tooltips = isAllQuarters ? TOOLTIPS_ALL : TOOLTIPS_QUARTER;

  const kpis = [
    { label: 'What entered the pipeline?', value: formatGBP(data.pipelineEntered), sub: `across ${data.pipelineEnteredCount} unique opportunities` },
    { label: 'What did we actually close?', value: formatGBP(data.closedWon), sub: `${data.closedWonCount} deals won` },
    { label: 'How much pipeline converted?', value: `${data.conversionRate.toFixed(1)}%`, sub: 'from pipeline to closed-won' },
    { label: 'What was a typical deal worth?', value: formatGBP(data.avgDealSize), sub: 'average deal value' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="bg-white rounded-xl border border-brand/15 p-4"
        >
          <p className="text-xs font-semibold text-brand/70 flex items-center gap-1">
            {kpi.label}
            <InfoTooltip tooltip={tooltips[kpi.label]} />
          </p>
          <p className="text-2xl font-bold text-brand mt-1">{kpi.value}</p>
          <p className="text-xs text-brand/50 mt-1">{kpi.sub}</p>
        </div>
      ))}
    </div>
  );
}
