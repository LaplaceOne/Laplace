import { act, render, screen } from '@testing-library/react';
import { Reveal } from './Reveal.js';

let observeCb: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | null = null;

beforeEach(() => {
  observeCb = null;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: any) { observeCb = cb; }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});

test('reveals content when it intersects', () => {
  render(<Reveal><p>hello</p></Reveal>);
  const el = screen.getByText('hello').parentElement!;
  expect(el.className).not.toMatch(/\bin\b/);
  act(() => observeCb!([{ isIntersecting: true, target: el }]));
  expect(el.className).toMatch(/in/);
});
