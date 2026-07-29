'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'replai-theme'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
}>({ theme: 'dark', setTheme: () => {} })

/**
 * Portal-only theme state. ThemeScript has already stamped the attribute
 * before hydration; this provider just mirrors it into React state and
 * persists changes. Removes the attribute on unmount so client-side
 * navigation out of the portal returns to the light-only tokens.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    if (current === 'light' || current === 'dark') setThemeState(current)
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    document.documentElement.dataset.theme = t
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // storage unavailable (private mode) — theme still applies for the session
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
