import { type Address, address, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';
import { getCluster } from '@laplace/registry';
import { INTENT_SEED, VALIDITY_SEED } from './constants.js';

// NOTE: every cluster currently shares the same placeholder program IDs (see @laplace/registry),
// so deriving against 'localnet' is correct for all clusters today. TODO: when devnet/mainnet
// program IDs diverge, thread the active cluster through these helpers from the Laplace client.
const laplaceProgram = (): Address => address(getCluster('localnet').programs.laplace);
const validityProgram = (): Address => address(getCluster('localnet').programs.validity);

export function intentPda(maker: Address, id: Uint8Array): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: laplaceProgram(),
    seeds: [INTENT_SEED, getAddressEncoder().encode(maker), id],
  });
}
export function validityConfigPda(configHash: Uint8Array): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({ programAddress: validityProgram(), seeds: [VALIDITY_SEED, configHash] });
}
