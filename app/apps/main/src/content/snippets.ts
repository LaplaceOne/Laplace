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

/** npm install command */
export const installCmd = 'npm i @laplace/sdk';
