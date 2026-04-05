import { useData } from './hooks/useData';
import { useFilters } from './hooks/useFilters';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { KPIBar } from './components/KPIBar';
import { StorySection } from './components/StorySection';
import { FunnelVsClosedChart } from './components/charts/FunnelVsClosedChart';

import { SankeyChart } from './components/charts/SankeyChart';
import { ComparisonBarChart } from './components/charts/ComparisonBarChart';
import { InsightsSection } from './components/InsightsSection';

function App() {
  const { data, loading, error } = useData();
  const { filters, filtered, setVerticals, setProducts, setQuarter } = useFilters(data);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-brand/60">Loading dashboard data...</p>
      </div>
    );
  }

  if (error || !data || !filtered) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Failed to load data: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <Header />
        <FilterBar
          options={data.filterOptions}
          filters={filters}
          onVerticalChange={setVerticals}
          onProductChange={setProducts}
          onQuarterChange={setQuarter}
        />

        <StorySection heading="Here is the big picture.">
          <KPIBar data={filtered.kpiValues} isAllQuarters={filters.quarter === 'All'} />
        </StorySection>

        <StorySection
          heading="How did our pipeline compare to what we actually closed?"
          description="Each quarter, we start with a pipeline of active opportunities. The blue bars show the total open pipeline at the start of each quarter, the orange bars show what we won, and the line tracks our conversion rate."
          tooltip={{
            definition: 'Pipeline Value = total open pipeline at the start of each quarter. Closed Won = deals whose latest stage within that quarter is Closed Won. Conversion % = Closed Won / Pipeline Value. QoQ % labels show quarter-over-quarter change.',
            why: 'Compares what we started with vs what we actually won each quarter — tracks whether our closing ability is improving or declining over time.',
          }}
        >
          <FunnelVsClosedChart data={filtered.allQuartersSummary} />
        </StorySection>

        <StorySection
          heading="How do deals flow through the pipeline?"
          description="The flow diagram shows how opportunities transition between sales stages. Wider bands represent larger deal values. Hover over any band or stage to see details."
          tooltip={{
            definition: 'Each band represents deal transitions from one stage to another. Width is proportional to total GBP value. "Entry" links show where opportunities first appeared in the pipeline. For a specific quarter, only transitions that occurred during that quarter are shown.',
            why: 'Reveals the actual paths deals take through the sales process — where they progress, where they stall, and where they exit.',
          }}
        >
          <SankeyChart data={filtered.flows} />
        </StorySection>

        <StorySection
          heading="How do different verticals and products compare?"
          description="Side-by-side view of total pipeline entered and closed-won value, broken down by vertical and product group. The line shows the conversion rate for each."
          tooltip={{
            definition: 'Pipeline In = total value that entered the pipeline (first entry value for "All", start-of-quarter snapshot for a specific quarter). Closed Won = total value of deals whose latest stage is Closed Won. Conversion % = Closed Won / Pipeline In.',
            why: 'Highlights which verticals and products drive the most pipeline and revenue — useful for resource allocation and strategic focus.',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ComparisonBarChart data={filtered.verticalComparison} title="By Vertical" />
            <ComparisonBarChart data={filtered.productComparison} title="By Product" />
          </div>
        </StorySection>

        <StorySection
          heading="What should you pay attention to?"
          description="Actionable insights derived from the current data and filters."
        >
          <InsightsSection data={filtered} filters={filters} />
        </StorySection>

      </div>
    </div>
  );
}

export default App;
