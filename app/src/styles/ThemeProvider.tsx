import React, { createContext, useContext, useState, ReactNode } from 'react';
import { theme, darkTheme, Theme } from './theme';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (themeName: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: 'light' | 'dark';
}

export function ThemeProvider({ children, initialTheme = 'light' }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(initialTheme === 'dark');

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const setTheme = (themeName: 'light' | 'dark') => {
    setIsDark(themeName === 'dark');
  };

  const currentTheme = isDark ? darkTheme : theme;

  const value: ThemeContextType = {
    theme: currentTheme,
    isDark,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeProvider;