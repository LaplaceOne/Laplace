import {
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
  type TransactionSigner,
  address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
} from '@solana/kit';
import { getCluster, type Cluster } from '@laplace/registry';
import {
  buildCreateIntent,
  buildFulfillIntent,
  buildRefundExpiredIntent,
  buildCloseIntent,
  buildCreateValidityConfig,
} from './instructions.js';
import { hashlockFulfillment, validityFulfillment, type CriterionSpec, type FulfillmentParts } from './criteria/index.js';
import { validityConfigPda } from './pdas.js';
import type { EscrowAssetInput } from './asset.js';
import type { ResolvedIntent } from './intent.js';

export type HashlockFulfill = { secret: ReadonlyUint8Array };
export type ValidityFulfill = { proof: ReadonlyUint8Array; publicInputsSuffix: ReadonlyUint8Array };
export type CustomFulfill = FulfillmentParts;

// Compute-unit limit for a validity/SP1 fulfill. On-chain Groth16 verification is ~270-350k CU,
// over the 200k default; 400k leaves headroom and stays well under the 1.4M tx max.
export const VALIDITY_FULFILL_COMPUTE_UNITS = 400_000;

export class Laplace {
  #rpc; #subs; readonly cluster: Cluster;
  constructor(opts: { rpc: any; rpcSubscriptions: any; cluster: Cluster }) {
    this.#rpc = opts.rpc; this.#subs = opts.rpcSubscriptions; this.cluster = opts.cluster;
  }

  async #send(instructions: Instruction[], feePayer: TransactionSigner): Promise<string> {
    const { value: blockhash } = await this.#rpc.getLatestBlockhash().send();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
    );
    const signed = await signTransactionMessageWithSigners(message);
    const signature = getSignatureFromTransaction(signed);
    // We always use blockhash lifetime above; cast to satisfy the factory's stricter type.
    await sendAndConfirmTransactionFactory({ rpc: this.#rpc, rpcSubscriptions: this.#subs })(signed as any, { commitment: 'confirmed' });
    return signature;
  }

  async createIntent(args: {
    maker: TransactionSigner; receiver: Address; refundRecipient?: Address;
    asset: EscrowAssetInput; amount: bigint; expirySlot: bigint; criterion: CriterionSpec; id?: ReadonlyUint8Array;
  }) {
    const built = await buildCreateIntent({ ...args, cluster: this.cluster });
    const signature = await this.#send(built.instructions, args.maker);
    return { signature, intentPda: built.intentPda, id: built.id, secret: built.secret };
  }

  async fulfillIntent(intent: ResolvedIntent, fulfillArgs: HashlockFulfill | ValidityFulfill | CustomFulfill, opts: { fulfiller: TransactionSigner }) {
    const fulfillment = await this.#resolveFulfillment(intent, fulfillArgs);
    // Validity/SP1 fulfillment runs Groth16 verification on-chain (~270-350k CU > the 200k default),
    // so raise the compute-unit limit for that criterion. Hashlock/custom stay on the default.
    const isValidity = intent.data.criterionProgram === address(getCluster(this.cluster).programs.validity);
    const computeUnitLimit = isValidity ? VALIDITY_FULFILL_COMPUTE_UNITS : undefined;
    const built = await buildFulfillIntent({ fulfiller: opts.fulfiller, intent: intent.data, intentAddress: intent.address, fulfillment, computeUnitLimit });
    return { signature: await this.#send(built.instructions, opts.fulfiller) };
  }

  async #resolveFulfillment(intent: ResolvedIntent, a: any): Promise<FulfillmentParts> {
    const hashlock = address(getCluster(this.cluster).programs.hashlock);
    const validity = address(getCluster(this.cluster).programs.validity);
    if (intent.data.criterionProgram === hashlock) return hashlockFulfillment({ secret: a.secret });
    if (intent.data.criterionProgram === validity) {
      const [configPda] = await validityConfigPda(intent.data.criterionDataHash as Uint8Array);
      return validityFulfillment({ proof: a.proof, publicInputsSuffix: a.publicInputsSuffix, configPda });
    }
    return a as FulfillmentParts;
  }

  async refundExpiredIntent(intent: ResolvedIntent, opts: { cranker: TransactionSigner }) {
    const built = await buildRefundExpiredIntent({ cranker: opts.cranker, intent: intent.data, intentAddress: intent.address });
    return { signature: await this.#send(built.instructions, opts.cranker) };
  }

  async closeIntent(intent: ResolvedIntent, opts: { maker: TransactionSigner }) {
    const built = await buildCloseIntent({ maker: opts.maker, intent: intent.data, intentAddress: intent.address });
    return { signature: await this.#send(built.instructions, opts.maker) };
  }

  async createValidityConfig(args: { guestElfHash: ReadonlyUint8Array; sp1VkeyHash: ReadonlyUint8Array; fixedPublicInputs: ReadonlyUint8Array }, opts: { payer: TransactionSigner }) {
    const built = await buildCreateValidityConfig({ payer: opts.payer, ...args });
    return { signature: await this.#send(built.instructions, opts.payer), configPda: built.configPda, configHash: built.configHash };
  }
}
