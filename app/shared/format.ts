export function formatUsd(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatCrypto(value?: string | number | null): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Fixed-amount invoices carry a `requestedAmount`; `paid` reflects what
// Uniwire's invoice_* callbacks have reported so far. Surfacing "paid of
// requested" here (rather than just a raw amount + status) is what lets a
// client see progress without checking the Uniwire dashboard.
// `format` picks the unit - formatCrypto (default) or formatUsd, with `paid`/
// `requested` already expressed in that same unit by the caller.
export function formatDepositProgress(
  paid: string | number | null | undefined,
  requested: string | number,
  format: (value: number) => string = formatCrypto,
): string {
  const paidNum = Number(paid ?? 0);
  const requestedNum = Number(requested);

  return `Paid ${format(paidNum)} of ${format(requestedNum)}`;
}

// When an invoice was requested in USD, Uniwire's own conversion at creation
// time is implied by (requestedFiatAmount / requestedAmount) - reusing that
// ratio for "paid so far" keeps the figure consistent with what the invoice
// itself was created at, rather than fetching a separate, possibly-drifted
// rate just for display.
export function estimateRequestedFiatPaid(
  paid: string | number | null | undefined,
  requestedCrypto: string | number,
  requestedFiat: string | number,
): number {
  const requestedCryptoNum = Number(requestedCrypto);
  if (!requestedCryptoNum) return 0;
  return (Number(paid ?? 0) / requestedCryptoNum) * Number(requestedFiat);
}

export function shortHash(value: string | null, start = 10, end = 8): string {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function explorerUrl(network: string, txid: string | null): string | null {
  if (!txid) return null;

  const n = String(network || "").toUpperCase();

  if (n.includes("BTC")) {
    return `https://mempool.space/testnet/tx/${txid}`;
  }

  if (n.includes("ETH")) {
    return `https://sepolia.etherscan.io/tx/${txid}`;
  }

  if (n.includes("TRX") || n.includes("TRON")) {
    return `https://nile.tronscan.org/#/transaction/${txid}`;
  }

  if (n.includes("SOL")) {
    return `https://solscan.io/tx/${txid}`;
  }

  return null;
}
