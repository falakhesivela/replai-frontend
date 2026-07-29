'use client'

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartTheme } from './use-chart-theme'
import { ChartLegend, type LineSeries } from './line-chart'

interface StackedBarChartProps {
  data: readonly object[]
  xKey: string
  series: LineSeries[]
  height?: number
  xFormat?: (v: string) => string
}

function BarTooltip({
  active,
  payload,
  label,
  xFormat,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; fill?: string }>
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
            style={{ backgroundColor: p.fill }}
          />
          {p.name}: <span className="font-mono tabular-nums text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function StackedBarChart({
  data,
  xKey,
  series,
  height = 240,
  xFormat,
}: StackedBarChartProps) {
  const { colors, ink3, line, surface } = useChartTheme()

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RBarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
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
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            content={<BarTooltip xFormat={xFormat} />}
            cursor={{ fill: line, opacity: 0.35 }}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              fill={s.color ?? colors[s.slot % colors.length]}
              // 2px surface gap between stacked segments
              stroke={surface}
              strokeWidth={2}
              radius={[2, 2, 0, 0]}
              maxBarSize={28}
            />
          ))}
        </RBarChart>
      </ResponsiveContainer>
      <ChartLegend series={series} />
    </div>
  )
}
