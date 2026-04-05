import type { StageBreakdown } from '../../types/data';
import { formatGBP } from '../../utils/format';

interface Props {
  data: StageBreakdown[];
}

const STAGE_ORDER = [
  'Discovery',
  'Meeting and Presentation',
  'Proposal Delivery',
  'Negotiating',
  'Waiting on Signature',
  'Closed Won',
];

const STAGE_COLORS: Record<string, string> = {
  'Discovery': '#b8d4e3',
  'Meeting and Presentation': '#5a8fa8',
  'Proposal Delivery': '#194866',
  'Negotiating': '#f27e24',
  'Waiting on Signature': '#ffcba4',
  'Closed Won': '#2e7d32',
};

const STAGE_TEXT_COLORS: Record<string, string> = {
  'Discovery': '#194866',
  'Meeting and Presentation': '#ffffff',
  'Proposal Delivery': '#ffffff',
  'Negotiating': '#ffffff',
  'Waiting on Signature': '#194866',
  'Closed Won': '#ffffff',
};

export function FunnelChart({ data }: Props) {
  // Aggregate stage values across all visible quarters
  const totals: Record<string, { value: number; count: number }> = {};
  for (const q of data) {
    for (const stage of STAGE_ORDER) {
      const s = q.stages[stage];
      if (s) {
        if (!totals[stage]) totals[stage] = { value: 0, count: 0 };
        totals[stage].value += s.value;
        totals[stage].count += s.count;
      }
    }
  }

  const maxValue = Math.max(...STAGE_ORDER.map((s) => totals[s]?.value ?? 0), 1);

  const svgWidth = 600;
  const svgHeight = 400;
  const layerHeight = 52;
  const layerGap = 8;
  const minWidthPct = 0.25;
  const centerX = svgWidth / 2;
  const startY = 20;

  return (
    <div className="bg-white rounded-xl border border-brand/15 p-5">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-xl mx-auto" role="img" aria-label="Pipeline funnel chart">
        {STAGE_ORDER.map((stage, i) => {
          const entry = totals[stage];
          const value = entry?.value ?? 0;
          const count = entry?.count ?? 0;
          const ratio = maxValue > 0 ? value / maxValue : 0;
          const widthPct = minWidthPct + (1 - minWidthPct) * ratio;
          const nextRatio = i < STAGE_ORDER.length - 1
            ? (totals[STAGE_ORDER[i + 1]]?.value ?? 0) / maxValue
            : ratio * 0.7;
          const nextWidthPct = minWidthPct + (1 - minWidthPct) * nextRatio;

          const topHalf = (svgWidth * widthPct) / 2;
          const bottomHalf = (svgWidth * nextWidthPct) / 2;
          const y = startY + i * (layerHeight + layerGap);

          const points = [
            `${centerX - topHalf},${y}`,
            `${centerX + topHalf},${y}`,
            `${centerX + bottomHalf},${y + layerHeight}`,
            `${centerX - bottomHalf},${y + layerHeight}`,
          ].join(' ');

          const textColor = STAGE_TEXT_COLORS[stage] ?? '#194866';

          return (
            <g key={stage}>
              <polygon
                points={points}
                fill={STAGE_COLORS[stage]}
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={centerX}
                y={y + layerHeight / 2 - 6}
                textAnchor="middle"
                fill={textColor}
                fontSize="13"
                fontWeight="600"
              >
                {stage}
              </text>
              <text
                x={centerX}
                y={y + layerHeight / 2 + 12}
                textAnchor="middle"
                fill={textColor}
                fontSize="12"
                opacity={0.85}
              >
                {formatGBP(value)} · {count} {count === 1 ? 'deal' : 'deals'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
