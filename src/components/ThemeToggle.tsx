import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const getNextTheme = () => {
    if (theme === 'light') return 'dark';
    if (theme === 'dark') return 'oled';
    return 'light';
  };

  const getThemeLabel = () => {
    if (theme === 'light') return 'dark';
    if (theme === 'dark') return 'OLED';
    return 'light';
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-sand-200 dark:bg-stone-700 oled:bg-black oled:hover:bg-gray-900 hover:bg-sand-300 dark:hover:bg-stone-600 transition-colors duration-200 border border-sand-300 dark:border-stone-600 oled:border-gray-800"
      aria-label={`Switch to ${getThemeLabel()} mode`}
      title={`Switch to ${getThemeLabel()} mode`}
    >
      {theme === 'light' ? (
        // Moon icon for dark mode
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-dune-700 dark:text-stone-300 oled:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : theme === 'dark' ? (
        // OLED icon (battery/power saving icon) for OLED mode
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-dune-700 dark:text-stone-300 oled:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ) : (
        // Sun icon for light mode
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-dune-700 dark:text-stone-300 oled:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
}

