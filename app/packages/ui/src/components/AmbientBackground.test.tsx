import { render } from '@testing-library/react';
import { AmbientBackground } from './AmbientBackground.js';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  // reduced-motion=true short-circuits the rAF loop to a single static frame.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  })) as any;
});

test('mounts a canvas and unmounts cleanly', () => {
  const { container, unmount } = render(<AmbientBackground />);
  expect(container.querySelector('canvas')).toBeTruthy();
  unmount();
});
