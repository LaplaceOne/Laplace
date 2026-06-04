import { toDisplay } from '@laplace-one/sdk';
import type { IntentAssetView } from './IntentView.js';

export function AssetAmount({ amount, asset, className }: { amount: bigint; asset: IntentAssetView; className?: string }) {
  return (
    <span className={className}>
      <span>{toDisplay(amount, asset.decimals)}</span>{' '}
      <span className="asset">{asset.symbol}</span>
    </span>
  );
}
