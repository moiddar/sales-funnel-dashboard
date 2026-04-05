import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { QuarterlySummary } from '../../types/data';
import { formatGBP, formatQuarter } from '../../utils/format';

interface ChartRow extends QuarterlySummary {
  funnel_pct_change: number | null;
  closed_won_pct_change: number | null;
}

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: ChartRow;
}

interface Props {
  data: QuarterlySummary[];
}

function formatPctChange(val: number | null): string {
  if (val === null) return '';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(0)}%`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const q = payload[0]?.payload;
  return (
    <div className="bg-white border border-brand/15 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-brand mb-2">
        {formatQuarter(label ?? '')}
        {q?.is_partial && <span className="text-accent ml-1">(partial)</span>}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}:</span>
          <span className="font-medium">
            {p.dataKey === 'conversion_rate' ? `${p.value}%` : formatGBP(p.value)}
          </span>
        </p>
      ))}
      {q?.funnel_pct_change !== null && (
        <p className="mt-1 text-xs text-gray-500">Pipeline QoQ: {formatPctChange(q!.funnel_pct_change)}</p>
      )}
      {q?.closed_won_pct_change !== null && (
        <p className="text-xs text-gray-500">Closed Won QoQ: {formatPctChange(q!.closed_won_pct_change)}</p>
      )}
    </div>
  );
}

function PctLabel(props: { x?: number; y?: number; width?: number; value?: number | null }) {
  const { x = 0, y = 0, width = 0, value } = props;
  if (value == null) return null;
  const color = value > 0 ? '#16a34a' : value < 0 ? '#dc2626' : '#6b7280';
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fontSize={10}
      fontWeight={600}
      fill={color}
    >
      {formatPctChange(value)}
    </text>
  );
}

export function FunnelVsClosedChart({ data }: Props) {
  const chartData: ChartRow[] = useMemo(() =>
    data.map((row, i) => {
      const prev = i > 0 ? data[i - 1] : null;
      return {
        ...row,
        funnel_pct_change: prev && prev.funnel_value
          ? ((row.funnel_value - prev.funnel_value) / prev.funnel_value) * 100
          : null,
        closed_won_pct_change: prev && prev.closed_won_value
          ? ((row.closed_won_value - prev.closed_won_value) / prev.closed_won_value) * 100
          : null,
      };
    }), [data]);

  return (
    <div className="bg-white rounded-xl border border-brand/15 p-5">
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#194866' }} tickFormatter={formatQuarter} />
          <YAxis
            yAxisId="left"
            tickFormatter={formatGBP}
            tick={{ fontSize: 12, fill: '#194866' }}
            width={70}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: '#194866' }}
            domain={[0, 'auto']}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
          />
          <Bar
            yAxisId="left"
            dataKey="funnel_value"
            name="Pipeline Value"
            fill="#194866"
            radius={[4, 4, 0, 0]}
            barSize={32}
            animationDuration={400}
          >
            <LabelList dataKey="funnel_pct_change" content={<PctLabel />} />
          </Bar>
          <Bar
            yAxisId="left"
            dataKey="closed_won_value"
            name="Closed Won"
            fill="#f27e24"
            radius={[4, 4, 0, 0]}
            barSize={32}
            animationDuration={400}
          >
            <LabelList dataKey="closed_won_pct_change" content={<PctLabel />} />
          </Bar>
          <Line
            yAxisId="right"
            dataKey="conversion_rate"
            name="Conversion %"
            stroke="#f27e24"
            strokeWidth={2.5}
            dot={{ fill: '#f27e24', r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
