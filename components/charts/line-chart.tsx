'use client'

import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartTheme } from './use-chart-theme'

export interface LineSeries {
  key: string
  label: string
  /** Fixed categorical slot (0-based). Color follows the entity, never rank. */
  slot: number
  /** Literal color override (e.g. neutral gray for a "neutral" category). */
  color?: string
}

interface LineChartProps {
  data: readonly object[]
  xKey: string
  series: LineSeries[]
  height?: number
  yFormat?: (v: number) => string
  xFormat?: (v: string) => string
}

function ChartTooltip({
  active,
  payload,
  label,
  xFormat,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; stroke?: string; fill?: string }>
  label?: string
  xFormat?: (v: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-overlay px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1 font-medium text-ink">
        {xFormat && label ? xFormat(label) : label}
      </p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-ink-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.stroke ?? p.fill }}
          />
          {p.name}: <span className="font-mono tabular-nums text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

/** Legend chips — identity via chip + text token, never colored text. */
export function ChartLegend({ series }: { series: LineSeries[] }) {
  const { colors } = useChartTheme()
  if (series.length < 2) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: s.color ?? colors[s.slot % colors.length] }}
          />
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function LineChart({
  data,
  xKey,
  series,
  height = 240,
  yFormat,
  xFormat,
}: LineChartProps) {
  const { colors, ink3, line } = useChartTheme()

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RLineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={line} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: ink3, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: line }}
            tickFormatter={xFormat}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: ink3, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormat}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            content={<ChartTooltip xFormat={xFormat} />}
            cursor={{ stroke: ink3, strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? colors[s.slot % colors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
              connectNulls
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>
      <ChartLegend series={series} />
    </div>
  )
}
