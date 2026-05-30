// Live-localnet test helpers: raw tx send + SPL mint/ATA setup + slot waiting.
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
  signTransactionMessageWithSigners, sendAndConfirmTransactionFactory, getSignatureFromTransaction,
  generateKeyPairSigner, type TransactionSigner, type Address, type Instruction,
} from '@solana/kit';
import { getCreateAccountInstruction } from '@solana-program/system';
import {
  getInitializeMintInstruction, getMintSize, getMintToInstruction,
  getCreateAssociatedTokenIdempotentInstructionAsync, findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

export async function sendIxs(rpc: any, rpcSubscriptions: any, feePayer: TransactionSigner, instructions: Instruction[]): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );
  const signed = await signTransactionMessageWithSigners(msg);
  await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signed as any, { commitment: 'confirmed' });
  return getSignatureFromTransaction(signed);
}

export async function createMint(rpc: any, subs: any, payer: TransactionSigner, decimals = 6): Promise<Address> {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = await rpc.getMinimumBalanceForRentExemption(space).send();
  const createAccount = getCreateAccountInstruction({
    payer, newAccount: mint, lamports: rent, space, programAddress: TOKEN_PROGRAM_ADDRESS,
  });
  const initMint = getInitializeMintInstruction({ mint: mint.address, decimals, mintAuthority: payer.address });
  await sendIxs(rpc, subs, payer, [createAccount, initMint]);
  return mint.address;
}

export async function ata(owner: Address, mint: Address): Promise<Address> {
  const [a] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return a;
}

export async function mintTokens(rpc: any, subs: any, mintAuthority: TransactionSigner, mint: Address, owner: Address, amount: bigint): Promise<Address> {
  const createAta = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: mintAuthority, owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const dest = await ata(owner, mint);
  const mintTo = getMintToInstruction({ mint, token: dest, mintAuthority, amount });
  await sendIxs(rpc, subs, mintAuthority, [createAta, mintTo]);
  return dest;
}

export async function tokenBalance(rpc: any, tokenAccount: Address): Promise<bigint> {
  const r = await rpc.getTokenAccountBalance(tokenAccount).send();
  return BigInt(r.value.amount);
}

export async function currentSlot(rpc: any): Promise<bigint> {
  return BigInt(await rpc.getSlot().send());
}

export async function waitForSlotPast(rpc: any, slot: bigint, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    const cur = BigInt(await rpc.getSlot().send());
    if (cur > slot) return;
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for slot > ${slot} (cur ${cur})`);
    await new Promise((r) => setTimeout(r, 400));
  }
}
