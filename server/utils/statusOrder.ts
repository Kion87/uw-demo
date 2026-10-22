// Status ordering for Uniwire callbacks.
//
// Callbacks can arrive late or out of order (e.g. a retried "pending" landing
// after "confirmed"). Without a guard, the late one would move the row
// backwards - for deposits that removes already-credited money from the
// balance. These ranks let the webhook ignore a callback that would move a
// row to an earlier stage than the one it's already at.
//
// Unknown statuses are never blocked (better to record something unexpected
// than silently drop it).

const DEPOSIT_RANK: Record<string, number> = {
  new: 0,
  pending: 1,
  transaction_pending: 1,
  invoice_pending: 1,
  underpaid: 2,
  confirmed: 3,
  transaction_confirmed: 3,
  invoice_confirmed: 3,
  complete: 4,
  transaction_complete: 4,
  invoice_complete: 4,
};

const WITHDRAWAL_RANK: Record<string, number> = {
  reserved: 0,
  pending: 1,
  initialized: 1,
  confirmed: 2,
  complete: 3,
  // Final outcomes: nothing should move a withdrawal out of these.
  rejected: 10,
  failed: 10,
};

function isDowngrade(
  ranks: Record<string, number>,
  current: string | null | undefined,
  next: string | null | undefined,
) {
  const c = current ? ranks[current.toLowerCase()] : undefined;
  const n = next ? ranks[next.toLowerCase()] : undefined;
  if (c === undefined || n === undefined) return false;
  return n < c;
}

export const isDepositDowngrade = (
  current: string | null | undefined,
  next: string | null | undefined,
) => isDowngrade(DEPOSIT_RANK, current, next);

export const isWithdrawalDowngrade = (
  current: string | null | undefined,
  next: string | null | undefined,
) => isDowngrade(WITHDRAWAL_RANK, current, next);
