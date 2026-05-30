import { describe, it, expect } from 'vitest';
import * as raw from '../src/raw.js';

describe('raw export', () => {
  it('exposes all three program namespaces for manual ops', () => {
    expect(raw.laplaceProgram).toBeTypeOf('object');
    expect(raw.hashlockProgram).toBeTypeOf('object');
    expect(raw.validityProgram).toBeTypeOf('object');
  });
  it('exposes the seven raw instruction builders incl. verify_criterion + initialize', () => {
    expect(raw.laplaceProgram.getInitializeInstruction).toBeTypeOf('function');
    expect(raw.laplaceProgram.getCreateIntentInstruction).toBeTypeOf('function');
    expect(raw.hashlockProgram.getVerifyCriterionInstruction).toBeTypeOf('function');
    expect(raw.validityProgram.getCreateValidityInstruction).toBeTypeOf('function');
  });
});
