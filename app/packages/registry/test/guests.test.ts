import { describe, it, expect } from 'vitest';
import { guests, getGuest, validityConfigs } from '../src/index.js';

describe('guests + validity configs', () => {
  it('ships no example guests this round', () => { expect(guests).toEqual([]); });
  it('getGuest returns undefined for any key', () => { expect(getGuest('fib')).toBeUndefined(); });
  it('validityConfigs is empty and filterable', () => {
    expect(validityConfigs()).toEqual([]);
    expect(validityConfigs({ cluster: 'devnet' })).toEqual([]);
    expect(validityConfigs({ guest: 'fib' })).toEqual([]);
  });
});
