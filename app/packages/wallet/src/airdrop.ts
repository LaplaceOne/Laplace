import { airdropFactory, lamports, type Address } from '@solana/kit';
export function makeAirdrop(rpc: any, rpcSubscriptions: any) {
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });
  return (recipient: Address, sol: number) => airdrop({ commitment: 'confirmed', recipientAddress: recipient, lamports: lamports(BigInt(Math.round(sol * 1e9))) });
}
