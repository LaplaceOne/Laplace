// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { LaplaceSdkProvider, useSlot, useLaplaceContext } from '../src/react/index.js';

function Probe() {
  const slot = useSlot();
  const ctx = useLaplaceContext();
  return <div>slot:{String(slot)}|cluster:{ctx.cluster}</div>;
}

describe('sdk/react', () => {
  it('exposes context values via hooks', () => {
    render(
      <LaplaceSdkProvider value={{ rpc: {} as any, rpcSubscriptions: {} as any, cluster: 'devnet', currentSlot: 42n }}>
        <Probe />
      </LaplaceSdkProvider>,
    );
    expect(screen.getByText('slot:42|cluster:devnet')).toBeTruthy();
  });
});
