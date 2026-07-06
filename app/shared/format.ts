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
export function formatDepositProgress(
  paid: string | number | null | undefined,
  requested: string | number,
): string {
  const paidNum = Number(paid ?? 0);
  const requestedNum = Number(requested);
  const due = requestedNum - paidNum;

  if (due > 0) {
    return `Paid ${formatCrypto(paidNum)} of ${formatCrypto(requestedNum)} · ${formatCrypto(due)} due`;
  }

  return `Paid ${formatCrypto(paidNum)} of ${formatCrypto(requestedNum)}`;
}
