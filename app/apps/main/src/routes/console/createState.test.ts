import { initialCreate, validateStep1, buildCriterion, computeExpirySlot, toBytes32Hex } from './createState';
import { toBaseUnits } from '@laplace/sdk';

test('computeExpirySlot adds minutesToSlots to current slot', () => {
  expect(computeExpirySlot(1000n, 10)).toBe(1000n + 1500n); // 10 min * 150 slots/min
});

test('validateStep1 requires a receiver and a positive amount', () => {
  const s = { ...initialCreate, amount: '', receiver: '' };
  expect(validateStep1(s).ok).toBe(false);
  const s2 = { ...initialCreate, amount: '1.5', receiver: 'Recv111111111111111111111111111111111111111' };
  expect(validateStep1(s2).ok).toBe(true);
});

test('buildCriterion(hashlock, generate) uses the saved secret', () => {
  const secret = new Uint8Array(32).fill(7);
  const spec = buildCriterion({ ...initialCreate, recipe: 'hashlock', hashMode: 'generate', secret });
  expect(spec.key).toBe('hashlock');
});

test('toBaseUnits converts human amounts', () => {
  expect(toBaseUnits('1.5', 9)).toBe(1500000000n);
});
