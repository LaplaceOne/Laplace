import { render } from '@testing-library/react';
import { CursorRing } from './CursorRing.js';

test('renders nothing on coarse pointers', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('pointer: coarse'), media: q,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  const { container } = render(<CursorRing />);
  expect(container.querySelector('[data-cursor-ring]')).toBeNull();
});
