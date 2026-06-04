import { criterionLabel } from './criterionLabel';
import { getCluster } from '@laplace-one/registry';

test('labels the hashlock program by its registry name + tier', () => {
  const hashlock = getCluster('devnet').programs.hashlock;
  const { name, tier } = criterionLabel(hashlock, 'devnet');
  expect(name).toMatch(/hashlock/i);
  expect(tier).toBe('official');
});

test('falls back to a short address for unknown programs', () => {
  const { name, tier } = criterionLabel('UnknownProGram1111111111111111111111111111', 'devnet');
  expect(name).toMatch(/Unkn/);
  expect(tier).toBe('unknown');
});
