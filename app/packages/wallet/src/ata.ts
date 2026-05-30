import { type Address, type TransactionSigner } from '@solana/kit';
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

export async function ataFor(args: { owner: Address; mint: Address; tokenProgram?: Address }): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({ owner: args.owner, mint: args.mint, tokenProgram: args.tokenProgram ?? TOKEN_PROGRAM_ADDRESS });
  return ata;
}
export async function createAtaIx(args: { payer: TransactionSigner; owner: Address; mint: Address; tokenProgram?: Address }) {
  const tokenProgram = args.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  return getCreateAssociatedTokenIdempotentInstructionAsync({ payer: args.payer, owner: args.owner, mint: args.mint, tokenProgram });
}
