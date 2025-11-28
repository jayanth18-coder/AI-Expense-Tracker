import { createContext, useContext, useEffect, useState } from "react";

// Only support 'dark' and 'light'
type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "expense-tracker-theme",
}: ThemeProviderProps) {
  // Only allow 'dark' or 'light', fallback to defaultTheme if anything else
  const getInitialTheme = () => {
    const stored = localStorage.getItem(storageKey);
    if (stored === "dark" || stored === "light") return stored;
    // If storage has 'system' or any invalid value, force to defaultTheme
    return defaultTheme;
  };

  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    // only 'light' or 'dark' are possible now
    root.classList.add(theme);
  }, [theme]);

  // Also on initial mount, if storage is not valid, fix it.
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== "light" && stored !== "dark") {
      localStorage.setItem(storageKey, theme);
    }
  }, [theme, storageKey]);

  const setTheme = (theme: Theme) => {
    localStorage.setItem(storageKey, theme);
    setThemeState(theme);
  };

  const value: ThemeProviderState = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
