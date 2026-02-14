import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'auto';

function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return t;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('bl-theme') as Theme) || 'light'
  );

  const applied = resolveTheme(theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', applied);
    localStorage.setItem('bl-theme', theme);
  }, [theme, applied]);

  useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((prev) => (resolveTheme(prev) === 'light' ? 'dark' : 'light')),
    []
  );

  return { theme, applied, setTheme, toggle };
}
