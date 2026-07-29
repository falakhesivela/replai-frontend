'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/components/theme/theme-provider'

export interface ChartTheme {
  /** Categorical slots — assigned per entity in fixed order, never cycled. */
  colors: string[]
  ink3: string
  line: string
  surface: string
}

const FALLBACK: ChartTheme = {
  colors: ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a'],
  ink3: '#8a8a96',
  line: '#e4e4ea',
  surface: '#ffffff',
}

/** Reads the chart CSS variables after mount (and re-reads on theme change)
 *  so recharts — which needs literal colors — always matches the theme. */
export function useChartTheme(): ChartTheme {
  const { theme } = useTheme()
  const [chart, setChart] = useState<ChartTheme>(FALLBACK)

  useEffect(() => {
    // CSS custom properties are only readable from the DOM, so this must run
    // post-mount and re-run when the theme attribute changes.
    const styles = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChart({
      colors: [1, 2, 3, 4, 5].map((n) =>
        read(`--chart-${n}`, FALLBACK.colors[n - 1])
      ),
      ink3: read('--ink-3', FALLBACK.ink3),
      line: read('--line', FALLBACK.line),
      surface: read('--surface', FALLBACK.surface),
    })
  }, [theme])

  return chart
}
