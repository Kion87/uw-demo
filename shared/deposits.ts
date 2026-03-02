export type DepositAssetKey =
  | "BTC"
  | "ETH"
  | "USDT_ERC20"
  | "TRX"
  | "SOL"
  | "USDC_SPL";

export type DepositAssetOption = {
  key: DepositAssetKey;
  label: string; // what you show in the UI
  currency: string; // Uniwire "currency" (BTC, ETH, USDT, TRX, SOL, USDC)
  kind: string; // Uniwire "kind" (chain)
};

export const DEPOSIT_ASSETS: DepositAssetOption[] = [
  { key: "BTC", label: "BTC (Bitcoin)", currency: "BTC", kind: "BTC" },
  { key: "ETH", label: "ETH (Ethereum)", currency: "ETH", kind: "ETH" },
  // ERC-20 token: currency=USDT, chain kind=ETH
  { key: "USDT_ERC20", label: "USDT (ERC-20)", currency: "USDT", kind: "ETH" },

  { key: "TRX", label: "TRX (Tron)", currency: "TRX", kind: "TRX" },
  { key: "SOL", label: "SOL (Solana)", currency: "SOL", kind: "SOL" },
  // SPL token: currency=USDC, chain kind=SOL
  {
    key: "USDC_SPL",
    label: "USDC (SPL / Solana)",
    currency: "USDC",
    kind: "SOL",
  },
];

export const DEPOSIT_ASSET_BY_KEY = Object.fromEntries(
  DEPOSIT_ASSETS.map((a) => [a.key, a]),
) as Record<DepositAssetKey, DepositAssetOption>;
