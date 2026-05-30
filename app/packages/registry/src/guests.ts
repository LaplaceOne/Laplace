import type { Cluster, ValidityGuestEntry, ValidityConfigEntry } from './types.js';

// Schema supports the full guest catalog; no example guests are seeded this round (spec §5.3).
export const guests: ValidityGuestEntry[] = [];
export function getGuest(key: string): ValidityGuestEntry | undefined {
  return guests.find((g) => g.key === key);
}

const VALIDITY_CONFIGS: ValidityConfigEntry[] = [];
export function validityConfigs(filter?: { cluster?: Cluster; guest?: string }): ValidityConfigEntry[] {
  return VALIDITY_CONFIGS.filter((v) =>
    (!filter?.cluster || v.cluster === filter.cluster) &&
    (!filter?.guest || v.guestKey === filter.guest));
}
