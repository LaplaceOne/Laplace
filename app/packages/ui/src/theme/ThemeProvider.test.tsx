import { act, render, renderHook, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider.js';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

test('defaults to light and reflects on <html data-theme>', () => {
  const { result } = renderHook(() => useTheme(), { wrapper });
  expect(result.current.theme).toBe('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

test('toggle flips theme, persists to localStorage, and updates <html>', () => {
  const { result } = renderHook(() => useTheme(), { wrapper });
  act(() => result.current.toggle());
  expect(result.current.theme).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(localStorage.getItem('laplace-theme')).toBe('dark');
});

test('reads persisted theme on mount', () => {
  localStorage.setItem('laplace-theme', 'dark');
  const { result } = renderHook(() => useTheme(), { wrapper });
  expect(result.current.theme).toBe('dark');
});
