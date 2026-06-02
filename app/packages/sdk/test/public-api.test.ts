import { describe, it, expect } from 'vitest';
import * as sdk from '../src/index.js';

describe('public API surface', () => {
  it('exports the facade + helpers', () => {
    for (const name of ['Laplace', 'Condition', 'intentPda', 'validityConfigPda', 'nativeSol', 'splToken',
      'toBaseUnits', 'toDisplay', 'minutesToSlots', 'fetchIntent', 'fetchIntents', 'effectiveStatus',
      'actionFor', 'intentShareLink', 'mapLaplaceError', 'hashConfig',
      'intentBindingHash', 'assertBoundPublicInputs']) {
      expect((sdk as any)[name], name).toBeDefined();
    }
  });
});
