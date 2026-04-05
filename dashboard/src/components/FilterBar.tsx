import type { FilterOptions, FilterState } from '../types/data';
import { formatQuarter } from '../utils/format';

interface FilterBarProps {
  options: FilterOptions;
  filters: FilterState;
  onVerticalChange: (v: string[]) => void;
  onProductChange: (p: string[]) => void;
  onQuarterChange: (quarter: string) => void;
}

export function FilterBar({
  options,
  filters,
  onVerticalChange,
  onProductChange,
  onQuarterChange,
}: FilterBarProps) {
  const toggleItem = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="bg-white rounded-xl border border-brand/15 p-5 mb-10 flex flex-wrap gap-8 items-start justify-center">
      {/* Vertical filter */}
      <div>
        <label className="block text-xs font-semibold text-brand/60 mb-2">
          Which verticals?
        </label>
        <div className="flex flex-wrap gap-2">
          {options.verticals.map((v) => (
            <button
              key={v}
              onClick={() => onVerticalChange(toggleItem(filters.verticals, v))}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filters.verticals.includes(v)
                  ? 'bg-brand text-white border-brand'
                  : filters.verticals.length === 0
                  ? 'bg-accent-light text-brand border-accent/30'
                  : 'bg-[#f5f5f5] text-brand/50 border-brand/15 hover:bg-accent-light'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Product filter */}
      <div>
        <label className="block text-xs font-semibold text-brand/60 mb-2">
          Which products?
        </label>
        <div className="flex flex-wrap gap-2">
          {options.products.map((p) => (
            <button
              key={p}
              onClick={() => onProductChange(toggleItem(filters.products, p))}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filters.products.includes(p)
                  ? 'bg-brand text-white border-brand'
                  : filters.products.length === 0
                  ? 'bg-accent-light text-brand border-accent/30'
                  : 'bg-[#f5f5f5] text-brand/50 border-brand/15 hover:bg-accent-light'
              }`}
            >
              {p.replace('Prod_', 'Product ')}
            </button>
          ))}
        </div>
      </div>

      {/* Quarter selector */}
      <div>
        <label className="block text-xs font-semibold text-brand/60 mb-2">
          Which quarter?
        </label>
        <select
          value={filters.quarter}
          onChange={(e) => onQuarterChange(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-brand/15 bg-white"
        >
          <option value="All">All quarters</option>
          {options.quarters.map((q) => (
            <option key={q} value={q}>
              {formatQuarter(q)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
