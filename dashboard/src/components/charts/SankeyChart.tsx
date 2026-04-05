import { useMemo, useState, useRef } from 'react';
import type { FlowLink } from '../../types/data';
import { formatGBP } from '../../utils/format';

interface Props {
  data: FlowLink[];
}

const STAGE_COLUMNS: Record<string, number> = {
  'Entry': 0,
  'Discovery': 1,
  'Meeting and Presentation': 2,
  'Proposal Delivery': 3,
  'Negotiating': 4,
  'Waiting on Signature': 5,
  'Closed Won': 6,
  'Closed Lost': 7,
};

// Vertical center position for each stage (0 = top, 1 = bottom of draw area).
// Spreads the "happy path" across the upper portion, Closed Lost sits lower.
const STAGE_Y_CENTER: Record<string, number> = {
  'Entry': 0.42,
  'Discovery': 0.38,
  'Meeting and Presentation': 0.25,
  'Proposal Delivery': 0.40,
  'Negotiating': 0.30,
  'Waiting on Signature': 0.22,
  'Closed Won': 0.15,
  'Closed Lost': 0.72,
};

const STAGE_COLORS: Record<string, string> = {
  'Entry': '#94a3b8',
  'Discovery': '#b8d4e3',
  'Meeting and Presentation': '#5a8fa8',
  'Proposal Delivery': '#194866',
  'Negotiating': '#f27e24',
  'Waiting on Signature': '#ffcba4',
  'Closed Won': '#2e7d32',
  'Closed Lost': '#b91c1c',
};

const STAGE_LABELS: Record<string, string> = {
  'Entry': 'Entry',
  'Discovery': 'Discovery',
  'Meeting and Presentation': 'Meeting &\nPresentation',
  'Proposal Delivery': 'Proposal\nDelivery',
  'Negotiating': 'Negotiating',
  'Waiting on Signature': 'Waiting on\nSignature',
  'Closed Won': 'Closed Won',
  'Closed Lost': 'Closed Lost',
};

interface NodeLayout {
  id: string;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  throughput: number;
  color: string;
}

interface LinkLayout {
  source: string;
  target: string;
  value: number;
  count: number;
  sy: number;
  ty: number;
  thickness: number;
  isBackward: boolean;
}

const SVG_WIDTH = 960;
const SVG_HEIGHT = 560;
const NODE_WIDTH = 18;
const PADDING_X = 80;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 20;
const MIN_LINK_THICKNESS = 2;

export function SankeyChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ type: 'node' | 'link'; id: string } | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: { label: string; value: number; count: number };
  } | null>(null);

  const { nodes, links, gradients } = useMemo(() => {
    if (data.length === 0) return { nodes: [], links: [], gradients: [] };

    // Determine which stages are present
    const stagesUsed = new Set<string>();
    for (const link of data) {
      stagesUsed.add(link.source);
      stagesUsed.add(link.target);
    }

    // Compute throughput per node (max of incoming, outgoing)
    const incoming: Record<string, number> = {};
    const outgoing: Record<string, number> = {};
    for (const link of data) {
      outgoing[link.source] = (outgoing[link.source] ?? 0) + link.value;
      incoming[link.target] = (incoming[link.target] ?? 0) + link.value;
    }
    const throughput: Record<string, number> = {};
    for (const s of stagesUsed) {
      throughput[s] = Math.max(incoming[s] ?? 0, outgoing[s] ?? 0);
    }

    // Compute columns used and x positions
    const columns: Record<number, string[]> = {};
    for (const s of stagesUsed) {
      const col = STAGE_COLUMNS[s] ?? 0;
      if (!columns[col]) columns[col] = [];
      columns[col].push(s);
    }
    const usedCols = Object.keys(columns).map(Number).sort((a, b) => a - b);
    const drawWidth = SVG_WIDTH - 2 * PADDING_X - NODE_WIDTH;
    const colCount = usedCols.length;
    const colSpacing = colCount > 1 ? drawWidth / (colCount - 1) : 0;
    const colX: Record<number, number> = {};
    usedCols.forEach((col, i) => {
      colX[col] = PADDING_X + i * colSpacing;
    });

    // Compute node heights — proportional to global max throughput
    const drawHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const globalMaxThroughput = Math.max(...Object.values(throughput), 1);
    // Cap node height so the largest node uses ~65% of draw area
    const maxNodeHeight = drawHeight * 0.65;
    const nodeMap: Record<string, NodeLayout> = {};

    for (const s of stagesUsed) {
      const t = throughput[s] ?? 0;
      const height = Math.max(14, (t / globalMaxThroughput) * maxNodeHeight);
      const centerY = PADDING_TOP + (STAGE_Y_CENTER[s] ?? 0.5) * drawHeight;
      const y = centerY - height / 2;

      nodeMap[s] = {
        id: s,
        col: STAGE_COLUMNS[s] ?? 0,
        x: colX[STAGE_COLUMNS[s] ?? 0],
        y,
        width: NODE_WIDTH,
        height,
        throughput: t,
        color: STAGE_COLORS[s] ?? '#94a3b8',
      };
    }

    // Compute link layouts — thickness proportional to global max (same scale as nodes)
    const sortedLinks = [...data].sort((a, b) => {
      const colA = STAGE_COLUMNS[a.target] ?? 0;
      const colB = STAGE_COLUMNS[b.target] ?? 0;
      if (colA !== colB) return colA - colB;
      return b.value - a.value;
    });

    const sourceOffset: Record<string, number> = {};
    const targetOffset: Record<string, number> = {};
    const linkLayouts: LinkLayout[] = [];

    for (const link of sortedLinks) {
      const sourceNode = nodeMap[link.source];
      const targetNode = nodeMap[link.target];
      if (!sourceNode || !targetNode) continue;

      // Thickness proportional to value, using same scale as node heights
      const thickness = Math.max(MIN_LINK_THICKNESS, (link.value / globalMaxThroughput) * maxNodeHeight);
      const isBackward = (STAGE_COLUMNS[link.source] ?? 0) > (STAGE_COLUMNS[link.target] ?? 0);

      const sy = sourceOffset[link.source] ?? 0;
      sourceOffset[link.source] = sy + thickness;

      const ty = targetOffset[link.target] ?? 0;
      targetOffset[link.target] = ty + thickness;

      linkLayouts.push({
        source: link.source,
        target: link.target,
        value: link.value,
        count: link.count,
        sy,
        ty,
        thickness,
        isBackward,
      });
    }

    // Build gradient definitions
    const gradientDefs: { id: string; from: string; to: string }[] = [];
    const seenGradients = new Set<string>();
    for (const link of linkLayouts) {
      const from = STAGE_COLORS[link.source] ?? '#94a3b8';
      const to = STAGE_COLORS[link.target] ?? '#94a3b8';
      const gid = `grad-${link.source.replace(/\s+/g, '_')}-${link.target.replace(/\s+/g, '_')}`;
      if (!seenGradients.has(gid)) {
        seenGradients.add(gid);
        gradientDefs.push({ id: gid, from, to });
      }
    }

    return {
      nodes: Object.values(nodeMap),
      links: linkLayouts,
      gradients: gradientDefs,
    };
  }, [data]);

  function buildLinkPath(link: LinkLayout): string {
    const sourceNode = nodes.find((n) => n.id === link.source);
    const targetNode = nodes.find((n) => n.id === link.target);
    if (!sourceNode || !targetNode) return '';

    const x0 = sourceNode.x + NODE_WIDTH;
    const y0 = sourceNode.y + link.sy;
    const x1 = targetNode.x;
    const y1 = targetNode.y + link.ty;
    const t = link.thickness;

    const mx = (x0 + x1) / 2;

    return [
      `M ${x0} ${y0}`,
      `C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`,
      `L ${x1} ${y1 + t}`,
      `C ${mx} ${y1 + t}, ${mx} ${y0 + t}, ${x0} ${y0 + t}`,
      'Z',
    ].join(' ');
  }

  function linkId(link: LinkLayout) {
    return `${link.source}→${link.target}`;
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + 12;
    const y = e.clientY - rect.top - 10;
    setTooltip((prev) => (prev ? { ...prev, x, y } : prev));
  }

  function handleLinkEnter(link: LinkLayout, e: React.MouseEvent) {
    const id = linkId(link);
    setHovered({ type: 'link', id });
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltip({
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 10,
        content: {
          label: `${link.source} \u2192 ${link.target}`,
          value: link.value,
          count: link.count,
        },
      });
    }
  }

  function handleNodeEnter(node: NodeLayout, e: React.MouseEvent) {
    setHovered({ type: 'node', id: node.id });
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltip({
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 10,
        content: {
          label: node.id,
          value: node.throughput,
          count: 0,
        },
      });
    }
  }

  function handleLeave() {
    setHovered(null);
    setTooltip(null);
  }

  function isLinkHighlighted(link: LinkLayout): boolean {
    if (!hovered) return false;
    if (hovered.type === 'link') return linkId(link) === hovered.id;
    if (hovered.type === 'node') return link.source === hovered.id || link.target === hovered.id;
    return false;
  }

  function isNodeHighlighted(node: NodeLayout): boolean {
    if (!hovered) return false;
    if (hovered.type === 'node') return node.id === hovered.id;
    if (hovered.type === 'link') {
      const [src, tgt] = hovered.id.split('\u2192');
      return node.id === src || node.id === tgt;
    }
    return false;
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-brand/15 p-5 text-center text-brand/40 py-12">
        No flow data available for this selection.
      </div>
    );
  }

  const lastCol = Math.max(...nodes.map((n) => n.col));

  return (
    <div className="bg-white rounded-xl border border-brand/15 p-5">
      <div ref={containerRef} className="relative" onMouseMove={handleMouseMove}>
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Pipeline stage flow diagram"
        >
          <defs>
            {gradients.map((g) => (
              <linearGradient key={g.id} id={g.id} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={g.from} />
                <stop offset="100%" stopColor={g.to} />
              </linearGradient>
            ))}
          </defs>

          {/* Links */}
          {links.map((link) => {
            const highlighted = isLinkHighlighted(link);
            const srcHighlighted = isNodeHighlighted(nodes.find((n) => n.id === link.source)!);
            const tgtHighlighted = isNodeHighlighted(nodes.find((n) => n.id === link.target)!);
            const dimmed = hovered && !highlighted && !srcHighlighted && !tgtHighlighted;
            const gid = `grad-${link.source.replace(/\s+/g, '_')}-${link.target.replace(/\s+/g, '_')}`;

            return (
              <path
                key={linkId(link)}
                d={buildLinkPath(link)}
                fill={`url(#${gid})`}
                opacity={highlighted ? 0.7 : dimmed ? 0.03 : 0.35}
                strokeDasharray={link.isBackward ? '6 3' : undefined}
                stroke={link.isBackward ? '#666' : 'none'}
                strokeWidth={link.isBackward ? 0.5 : 0}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={(e) => handleLinkEnter(link, e)}
                onMouseLeave={handleLeave}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const highlighted = isNodeHighlighted(node);
            const dimmed = hovered && !highlighted;
            const isLast = node.col >= lastCol - 1; // Closed Won & Closed Lost: label right
            const labelLines = (STAGE_LABELS[node.id] ?? node.id).split('\n');

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  fill={node.color}
                  rx={3}
                  opacity={dimmed ? 0.7 : 1}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={(e) => handleNodeEnter(node, e)}
                  onMouseLeave={handleLeave}
                />
                {isLast ? (
                  <>
                    {labelLines.map((line, li, arr) => (
                      <text
                        key={li}
                        x={node.x + NODE_WIDTH + 8}
                        y={node.y + node.height / 2 + (li - (arr.length - 1) / 2) * 13 - 6}
                        textAnchor="start"
                        dominantBaseline="central"
                        fontSize="11"
                        fontWeight="600"
                        fill="#194866"
                        opacity={dimmed ? 0.55 : 0.85}
                        className="pointer-events-none select-none"
                      >
                        {line}
                      </text>
                    ))}
                    <text
                      x={node.x + NODE_WIDTH + 8}
                      y={node.y + node.height / 2 + (labelLines.length - 1) / 2 * 13 + 8}
                      textAnchor="start"
                      dominantBaseline="central"
                      fontSize="9.5"
                      fill="#194866"
                      opacity={dimmed ? 0.4 : 0.55}
                      className="pointer-events-none select-none"
                    >
                      {formatGBP(node.throughput)}
                    </text>
                  </>
                ) : (
                  <>
                    {/* Non-terminal: label below node */}
                    {labelLines.map((line, li) => (
                      <text
                        key={li}
                        x={node.x + NODE_WIDTH / 2}
                        y={node.y + node.height + 14 + li * 12}
                        textAnchor="middle"
                        dominantBaseline="auto"
                        fontSize="10.5"
                        fontWeight="600"
                        fill="#194866"
                        opacity={dimmed ? 0.55 : 0.85}
                        className="pointer-events-none select-none"
                      >
                        {line}
                      </text>
                    ))}
                    <text
                      x={node.x + NODE_WIDTH / 2}
                      y={node.y + node.height + 14 + labelLines.length * 12 + 2}
                      textAnchor="middle"
                      dominantBaseline="auto"
                      fontSize="9.5"
                      fill="#194866"
                      opacity={dimmed ? 0.4 : 0.55}
                      className="pointer-events-none select-none"
                    >
                      {formatGBP(node.throughput)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute bg-white border border-brand/15 rounded-lg px-3 py-2 shadow-lg text-sm pointer-events-none z-10"
            style={{ left: tooltip.x, top: tooltip.y, maxWidth: 260 }}
          >
            <p className="font-semibold text-brand text-xs">{tooltip.content.label}</p>
            <p className="text-brand/70 text-xs mt-0.5">
              {formatGBP(tooltip.content.value)}
              {tooltip.content.count > 0 && ` \u00b7 ${tooltip.content.count} ${tooltip.content.count === 1 ? 'transition' : 'transitions'}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
