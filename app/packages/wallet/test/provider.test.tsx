// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as React from 'react';
import { LaplaceProvider } from '../src/provider.js';
describe('LaplaceProvider', () => {
  it('renders children and provides the sdk/react context (disconnected)', () => {
    const { container } = render(
      <LaplaceProvider cluster="devnet"><span>ok</span></LaplaceProvider>,
    );
    expect(container.textContent).toContain('ok');
  });
});
