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
// client see how much more is due without checking the Uniwire dashboard.
// `format` picks the unit - formatCrypto (default) or formatUsd, with `paid`/
// `requested` already expressed in that same unit by the caller.
export function formatDepositProgress(
  paid: string | number | null | undefined,
  requested: string | number,
  format: (value: number) => string = formatCrypto,
): string {
  const paidNum = Number(paid ?? 0);
  const requestedNum = Number(requested);
  const due = requestedNum - paidNum;

  if (due > 0) {
    return `Paid ${format(paidNum)} of ${format(requestedNum)} · ${format(due)} due`;
  }

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
