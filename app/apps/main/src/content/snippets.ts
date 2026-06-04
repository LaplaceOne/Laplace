/** Token classes: c=comment, k=keyword, s=string, n=name/bold */
export type TokenCls = 'c' | 'k' | 's' | 'n';
export interface Token { text: string; cls?: TokenCls }

/**
 * create-intent.ts code sample, ported from index.html / docs.html
 * <pre class="code__body"> content.
 */
export const createIntent: Token[] = [
  { text: '// lock 1,200 USDC, release on a revealed secret\n', cls: 'c' },
  { text: 'const', cls: 'k' },
  { text: ' intent = ' },
  { text: 'await', cls: 'k' },
  { text: ' laplace.' },
  { text: 'createIntent', cls: 'n' },
  { text: '({\n' },
  { text: '  asset:     { spl: USDC }, amount: ' },
  { text: '1_200e6', cls: 'n' },
  { text: ',\n' },
  { text: '  receiver:  bob, refundRecipient: alice,\n' },
  { text: '  criterion: Condition.' },
  { text: 'hashlock', cls: 'n' },
  { text: '({ secret }),\n' },
  { text: '  expirySlot: currentSlot + ' },
  { text: 'minutesToSlots', cls: 'n' },
  { text: '(' },
  { text: '60', cls: 'n' },
  { text: '),\n' },
  { text: '});\n\n' },
  { text: '// anyone reveals the preimage → atomic release\n', cls: 'c' },
  { text: 'await', cls: 'k' },
  { text: ' laplace.' },
  { text: 'fulfillIntent', cls: 'n' },
  { text: '(intent, { secret });' },
];

/**
 * Full create-intent.ts code sample for the Docs §quickstart, ported from docs.html
 * <pre class="code__body"> (adds fulfill / refund / close lines).
 */
export const createIntentFull: Token[] = [
  { text: 'import', cls: 'k' },
  { text: ' { Laplace, Condition } ' },
  { text: 'from', cls: 'k' },
  { text: ' ' },
  { text: '"@laplace-one/sdk"', cls: 's' },
  { text: ';\n\n' },
  { text: '// lock 1,200 USDC, release on a revealed secret\n', cls: 'c' },
  { text: 'const', cls: 'k' },
  { text: ' intent = ' },
  { text: 'await', cls: 'k' },
  { text: ' laplace.' },
  { text: 'createIntent', cls: 'n' },
  { text: '({\n' },
  { text: '  asset:     { spl: USDC }, amount: ' },
  { text: '1_200e6', cls: 'n' },
  { text: ',\n' },
  { text: '  receiver:  bob, refundRecipient: alice,\n' },
  { text: '  criterion: Condition.' },
  { text: 'hashlock', cls: 'n' },
  { text: '({ secret }),  ' },
  { text: '// commitment binds to this intent\n', cls: 'c' },
  { text: '  expirySlot: currentSlot + ' },
  { text: 'minutesToSlots', cls: 'n' },
  { text: '(' },
  { text: '60', cls: 'n' },
  { text: '),\n' },
  { text: '});\n\n' },
  { text: '// anyone reveals the preimage → atomic release\n', cls: 'c' },
  { text: 'await', cls: 'k' },
  { text: ' laplace.' },
  { text: 'fulfillIntent', cls: 'n' },
  { text: '(intent, { secret });\n' },
  { text: '// …or refund after expiry, then reclaim rent\n', cls: 'c' },
  { text: 'await', cls: 'k' },
  { text: ' laplace.' },
  { text: 'refundExpiredIntent', cls: 'n' },
  { text: '(intent);\n' },
  { text: 'await', cls: 'k' },
  { text: ' laplace.' },
  { text: 'closeIntent', cls: 'n' },
  { text: '(intent);' },
];

/**
 * Criterion interface constants, ported from docs.html §interface
 * <pre class="code__body"> ("interface constants").
 */
export const interfaceConstants: Token[] = [
  { text: 'discriminator', cls: 'k' },
  { text: ' = first8(sha256("global:verify_criterion"))\n' },
  { text: '              = ' },
  { text: '8c 7b 8b 85 67 d5 72 ab', cls: 's' },
  { text: '\n' },
  { text: 'interface_version', cls: 'k' },
  { text: ' = 2\n' },
  { text: 'max_fulfillment_data', cls: 'k' },
  { text: ' = 1024 bytes' },
];

/**
 * CriterionVerificationRequest struct, ported from docs.html §interface
 * <pre class="code__body"> ("CriterionVerificationRequest").
 */
export const requestStruct: Token[] = [
  { text: 'pub struct', cls: 'k' },
  { text: ' CriterionVerificationRequest {\n' },
  { text: '  interface_version, protocol_program, intent, intent_id,\n' },
  { text: '  maker, receiver, refund_recipient, asset, amount,\n' },
  { text: '  expiry_slot, created_slot, criterion_program,\n' },
  { text: '  criterion_data_hash, fulfillment_data: ' },
  { text: 'Vec', cls: 'k' },
  { text: '<u8>,\n' },
  { text: '}' },
];

/** npm install command */
export const installCmd = 'npm i @laplace-one/sdk';
