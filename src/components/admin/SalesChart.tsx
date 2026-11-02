"use client";

// Paid test orders per day: one series, so one ink colour (no legend; the title names it). Thin bars with rounded
// tops on a quiet grid; hover or focus a day for its numbers; the same figures are in a table below.
import { useState } from "react";
import { formatPrice } from "@/lib/format";

export interface Day {
  day: string;
  orders: number;
  revenuePence: number;
}

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 36 };
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const label = (d: string) => DAY.format(new Date(`${d}T00:00:00Z`));

export function SalesChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.orders));
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = plotW / days.length;
  const barW = Math.max(3, Math.min(14, step - 4));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = [0, top / 2, top];
  const shown = active !== null ? days[active] : null;

  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={`Paid test orders per day for the last ${days.length} days`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11} fill="var(--ink-soft)">
                {t}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = PAD.left + i * step + (step - barW) / 2;
            const h = Math.max(0, y(0) - y(d.orders));
            return (
              <g key={d.day}>
                {h > 0 && <rect x={x} y={y(d.orders)} width={barW} height={h} rx={Math.min(4, barW / 2)} fill="var(--ink)" opacity={active === null || active === i ? 1 : 0.35} />}
                {/* Hit target wider than the bar, full height. */}
                <rect
                  x={PAD.left + i * step}
                  y={PAD.top}
                  width={step}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${label(d.day)}: ${d.orders} ${d.orders === 1 ? "order" : "orders"}, ${formatPrice(d.revenuePence)}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none focus-visible:fill-[var(--line)]"
                />
              </g>
            );
          })}
          {[0, Math.floor(days.length / 2), days.length - 1].map((i) =>
            days[i] ? (
              <text key={i} x={PAD.left + i * step + step / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--ink-soft)">
                {label(days[i]!.day)}
              </text>
            ) : null,
          )}
        </svg>
        {shown && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg"
            style={{ left: `${((PAD.left + active! * step + step / 2) / W) * 100}%`, transform: "translate(-50%, -100%)" }}
          >
            <p className="font-semibold">{label(shown.day)}</p>
            <p className="tabular-nums text-ink-soft">
              {shown.orders} {shown.orders === 1 ? "order" : "orders"} · {formatPrice(shown.revenuePence)}
            </p>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">Show as a table</summary>
        <table className="mt-3 w-full text-left tabular-nums">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">Orders</th>
              <th className="py-1 text-right font-medium">Test revenue</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1">{label(d.day)}</td>
                <td className="py-1 text-right">{d.orders}</td>
                <td className="py-1 text-right">{formatPrice(d.revenuePence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
