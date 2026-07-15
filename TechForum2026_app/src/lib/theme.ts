// Тема приложения: тёмная (дефолт, бренд) / светлая. Применяется установкой
// атрибута data-theme="light" на <html> — CSS-переменные светлой палитры живут
// в index.css (:root[data-theme="light"]). Выбор сохраняется в localStorage.
export type Theme = 'dark' | 'light';

const LS_KEY = 'techforum_theme';

export function getTheme(): Theme {
  try {
    return localStorage.getItem(LS_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  // Цвет статус-бара под тему.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f3f4f9' : '#0f1118');
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(LS_KEY, theme); } catch { /* private mode — ignore */ }
  applyTheme(theme);
}

// Применить сохранённую тему как можно раньше (main.tsx). В index.html есть
// дополнительный inline-скрипт, чтобы не было вспышки тёмного до загрузки JS.
export function initTheme(): void {
  applyTheme(getTheme());
}
