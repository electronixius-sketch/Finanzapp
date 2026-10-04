import { useState } from 'react';
import { formatMonth, formatMonthShort } from '../lib/dates';
import { formatCents, formatEuro, formatPercent, formatSigned, formatTick } from '../lib/money';
import type { BudgetStatus, MonthPoint } from '../lib/stats';
import type { Category } from '../lib/types';
import { useElementWidth } from './ui';

/* ---------- Spending by category: one series, so one hue for every bar. ---------- */

export function CategoryBars({
  items,
  categories,
  onSelect,
}: {
  items: { categoryId: string; total: number }[];
  categories: Category[];
  onSelect: (categoryId: string) => void;
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sum = items.reduce((s, i) => s + i.total, 0);
  // More than eight rows stops being readable – fold the tail into one row.
  const shown = items.length > 8 ? items.slice(0, 7) : items;
  const rest = items.slice(shown.length);
  const restTotal = rest.reduce((s, i) => s + i.total, 0);
  const max = Math.max(...items.map((i) => i.total), 1);

  return (
    <div className="bars">
      {shown.map((item) => {
        const c = byId.get(item.categoryId);
        return (
          <button
            key={item.categoryId}
            type="button"
            className="bar-row"
            onClick={() => onSelect(item.categoryId)}
            title={`${c?.name ?? 'Unbekannt'}: ${formatCents(item.total)} – Buchungen anzeigen`}
          >
            <span className="bar-label">
              {c?.icon} {c?.name ?? 'Unbekannt'}
            </span>
            <span className="bar-track">
              <span className="bar-fill" style={{ display: 'block', width: `${(item.total / max) * 100}%` }} />
            </span>
            <span className="bar-value">
              {formatEuro(item.total)}
              <small>{formatPercent(item.total / sum)}</small>
            </span>
          </button>
        );
      })}
      {rest.length > 0 && (
        <div className="bar-row" style={{ cursor: 'default' }}>
          <span className="bar-label">Weitere ({rest.length})</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ display: 'block', width: `${(restTotal / max) * 100}%` }}
            />
          </span>
          <span className="bar-value">
            {formatEuro(restTotal)}
            <small>{formatPercent(restTotal / sum)}</small>
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- 12-month income vs. expenses: grouped columns, one shared y-axis. ---------- */

function niceStep(max: number, ticks: number): number {
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * magnitude >= raw) return m * magnitude;
  }
  return 10 * magnitude;
}

/** Column with a 4px rounded data end and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

const SERIES = [
  { key: 'income', label: 'Einnahmen', color: 'var(--series-1)' },
  { key: 'expense', label: 'Ausgaben', color: 'var(--series-2)' },
] as const;

export function TrendChart({
  points,
  current,
  onSelect,
}: {
  points: MonthPoint[];
  current: string;
  onSelect: (month: string) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const height = 220;
  const margin = { top: 8, right: 4, bottom: 24, left: 44 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const maxValue = Math.max(...points.flatMap((p) => [p.income, p.expense]), 0);
  const step = maxValue > 0 ? niceStep(maxValue, 4) : 50000;
  const top = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => margin.top + plotH - (v / top) * plotH;

  const band = points.length ? plotW / points.length : 0;
  const barW = Math.max(3, Math.min(24, (band * 0.72 - 2) / 2));
  const labelEvery = band < 30 ? 2 : 1;
  const activePoint = active !== null ? points[active] : null;

  return (
    <div>
      <div className="legend">
        {SERIES.map((s) => (
          <span key={s.key} className="legend-key">
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <button type="button" className="link-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Als Diagramm' : 'Als Tabelle'}
        </button>
      </div>

      {showTable ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Monat</th>
                <th>Einnahmen</th>
                <th>Ausgaben</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month}>
                  <td>{formatMonth(p.month)}</td>
                  <td>{formatCents(p.income)}</td>
                  <td>{formatCents(p.expense)}</td>
                  <td>{formatSigned(p.income - p.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={ref} onPointerLeave={() => setActive(null)}>
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label="Einnahmen und Ausgaben der letzten 12 Monate">
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={margin.left}
                    x2={width - margin.right}
                    y1={y(t)}
                    y2={y(t)}
                    stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text className="tick" x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                    {formatTick(t)}
                  </text>
                </g>
              ))}
              {points.map((p, i) => {
                const x0 = margin.left + i * band;
                const groupX = x0 + (band - (barW * 2 + 2)) / 2;
                return (
                  <g key={p.month}>
                    <rect
                      className={`hit${active === i ? ' active' : ''}`}
                      x={x0}
                      y={margin.top}
                      width={band}
                      height={plotH}
                      rx={6}
                      tabIndex={0}
                      role="button"
                      aria-label={`${formatMonth(p.month)}: Einnahmen ${formatCents(p.income)}, Ausgaben ${formatCents(p.expense)}`}
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      onClick={() => onSelect(p.month)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(p.month);
                        }
                      }}
                    />
                    {SERIES.map((s, k) => {
                      const v = p[s.key];
                      if (v <= 0) return null;
                      const h = Math.max(1, plotH - (y(v) - margin.top));
                      return (
                        <path
                          key={s.key}
                          d={columnPath(groupX + k * (barW + 2), y(v), barW, h)}
                          fill={s.color}
                          pointerEvents="none"
                        />
                      );
                    })}
                    {i % labelEvery === (points.length - 1) % labelEvery && (
                      <text
                        className={`tick${p.month === current ? ' current' : ''}`}
                        x={x0 + band / 2}
                        y={height - 6}
                        textAnchor="middle"
                      >
                        {formatMonthShort(p.month)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
          {activePoint && active !== null && (
            <div
              className="tooltip"
              // Sit beside the hovered month, on whichever side has room, so it never covers it.
              style={
                margin.left + (active + 0.5) * band > width / 2
                  ? { top: margin.top, right: width - (margin.left + active * band) + 4 }
                  : { top: margin.top, left: margin.left + (active + 1) * band + 4 }
              }
            >
              <div className="tooltip-title">{formatMonth(activePoint.month)}</div>
              {SERIES.map((s) => (
                <div key={s.key} className="tooltip-row">
                  <span className="line-key" style={{ background: s.color }} />
                  <strong>{formatCents(activePoint[s.key])}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
              <div className="tooltip-row">
                <span className="line-key" />
                <strong>{formatSigned(activePoint.income - activePoint.expense)}</strong>
                <span>Saldo</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Budget meters ---------- */

export function BudgetList({ items }: { items: BudgetStatus[] }) {
  return (
    <div>
      {items.map(({ category, spent, budget, ratio }) => {
        const level = ratio >= 1 ? 'critical' : ratio >= 0.8 ? 'warning' : '';
        return (
          <div key={category.id} className="budget">
            <div className="budget-top">
              <strong>
                {category.icon} {category.name}
              </strong>
              <span>
                {formatEuro(spent)} von {formatEuro(budget)}
              </span>
            </div>
            <div
              className={`meter ${level}`}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={budget / 100}
              aria-valuenow={spent / 100}
              aria-label={`Budget ${category.name}`}
            >
              <div style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
            </div>
            <div className={`budget-note ${level === 'critical' ? 'critical' : ''}`}>
              {ratio >= 1
                ? `⚠ Überschritten um ${formatEuro(spent - budget)}`
                : `${level === 'warning' ? '● Fast aufgebraucht – ' : ''}noch ${formatEuro(budget - spent)} übrig`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
