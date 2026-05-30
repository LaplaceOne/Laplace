import { createSolanaRpc, createSolanaRpcSubscriptions, generateKeyPairSigner, airdropFactory, lamports, type KeyPairSigner } from '@solana/kit';
export const RUN = process.env.LAPLACE_LOCALNET === '1';
export function localnet() {
  const rpc = createSolanaRpc('http://127.0.0.1:8899');
  const rpcSubscriptions = createSolanaRpcSubscriptions('ws://127.0.0.1:8900');
  return { rpc, rpcSubscriptions };
}
export async function fundedSigner(rpc: any, rpcSubscriptions: any, sol = 5): Promise<KeyPairSigner> {
  const signer = await generateKeyPairSigner();
  await airdropFactory({ rpc, rpcSubscriptions })({ commitment: 'confirmed', recipientAddress: signer.address, lamports: lamports(BigInt(sol * 1e9)) });
  return signer;
}
