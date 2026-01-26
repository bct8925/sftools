import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { initTheme, getTheme, setTheme as setThemeStorage } from '../lib/theme';

type ThemeValue = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeValue;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeValue) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeValue>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  const updateEffectiveTheme = useCallback(() => {
    const current = getTheme() as ThemeValue;
    if (current === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setEffectiveTheme(isDark ? 'dark' : 'light');
    } else {
      setEffectiveTheme(current);
    }
  }, []);

  useEffect(() => {
    initTheme().then(() => {
      setThemeState(getTheme() as ThemeValue);
      updateEffectiveTheme();
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => updateEffectiveTheme();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [updateEffectiveTheme]);

  const setTheme = useCallback(
    async (newTheme: ThemeValue) => {
      await setThemeStorage(newTheme);
      setThemeState(newTheme);
      updateEffectiveTheme();
    },
    [updateEffectiveTheme]
  );

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<ThemeContextType>(
    () => ({ theme, effectiveTheme, setTheme }),
    [theme, effectiveTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
