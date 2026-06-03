import { Icon } from './Icon.js';
import { useTheme } from '../theme/ThemeProvider.js';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className={className ?? 'theme-toggle'}
      aria-label="Toggle theme"
      onClick={toggle}
    >
      <Icon icon={theme === 'dark' ? 'eva:sun-outline' : 'eva:moon-outline'} />
    </button>
  );
}
