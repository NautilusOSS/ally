import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'oled';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, default to 'dark'
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'dark';
  });

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    // Remove all theme classes first
    root.classList.remove('dark', 'oled');
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'oled') {
      root.classList.add('oled');
    }
    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      // Cycle through: light -> dark -> oled -> light
      if (prevTheme === 'light') return 'dark';
      if (prevTheme === 'dark') return 'oled';
      return 'light';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

