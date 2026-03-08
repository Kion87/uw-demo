export type DepositAssetKey =
  | "BTC"
  | "ETH"
  | "USDT_ERC20"
  | "USDT_TRC20"
  | "USDT_BEP20"
  | "TRX"
  | "SOL"
  | "USDC_SPL"
  | "USDC_ERC20";

export type DepositAssetOption = {
  key: DepositAssetKey;
  label: string;
  currency: string;
  kind: string;
};

export const DEPOSIT_ASSETS: DepositAssetOption[] = [
  { key: "BTC", label: "BTC (Bitcoin)", currency: "BTC", kind: "BTC" },
  { key: "ETH", label: "ETH (Ethereum)", currency: "ETH", kind: "ETH" },
  { key: "USDT_ERC20", label: "USDT (ERC-20)", currency: "USDT", kind: "ETH" },
  { key: "USDT_TRC20", label: "USDT (TRC20)", currency: "USDT", kind: "TRX" },
  { key: "USDT_BEP20", label: "USDT (BEP20)", currency: "USDT", kind: "BNB" },
  { key: "TRX", label: "TRX (Tron)", currency: "TRX", kind: "TRX" },
  { key: "SOL", label: "SOL (Solana)", currency: "SOL", kind: "SOL" },
  {
    key: "USDC_SPL",
    label: "USDC (SPL / Solana)",
    currency: "USDC",
    kind: "SOL",
  },
  {
    key: "USDC_ERC20",
    label: "USDC (ERC-20)",
    currency: "USDC",
    kind: "ETH",
  },
];

export const DEPOSIT_ASSET_BY_KEY = Object.fromEntries(
  DEPOSIT_ASSETS.map((a) => [a.key, a]),
) as Record<DepositAssetKey, DepositAssetOption>;
