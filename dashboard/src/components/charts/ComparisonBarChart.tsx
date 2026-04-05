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
} from 'recharts';
import type { ComparisonEntry } from '../../types/data';
import { formatGBP } from '../../utils/format';

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-brand/15 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-brand mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}:</span>
          <span className="font-medium">
            {p.dataKey === 'conversionRate' ? `${p.value}%` : formatGBP(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

interface Props {
  data: ComparisonEntry[];
  title: string;
}

export function ComparisonBarChart({ data, title }: Props) {
  return (
    <div className="bg-white rounded-xl border border-brand/15 p-5 flex-1 min-w-0">
      <h3 className="text-sm font-medium text-brand/70 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#194866' }} />
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
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
          <Bar
            yAxisId="left"
            dataKey="pipelineIn"
            name="Pipeline In"
            fill="#194866"
            radius={[4, 4, 0, 0]}
            barSize={28}
            animationDuration={400}
          />
          <Bar
            yAxisId="left"
            dataKey="closedWon"
            name="Closed Won"
            fill="#f27e24"
            radius={[4, 4, 0, 0]}
            barSize={28}
            animationDuration={400}
          />
          <Line
            yAxisId="right"
            dataKey="conversionRate"
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
