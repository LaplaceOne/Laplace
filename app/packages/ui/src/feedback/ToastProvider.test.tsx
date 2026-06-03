import { act, render, renderHook, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider.js';

test('shows a toast message via useToast', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <ToastProvider>{children}</ToastProvider>;
  const { result } = renderHook(() => useToast(), { wrapper });
  act(() => result.current.toast('Saved'));
  expect(screen.getByText('Saved')).toBeInTheDocument();
});
