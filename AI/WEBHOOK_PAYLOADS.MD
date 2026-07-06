# WEBHOOK_PAYLOADS.md

## Uniwire Webhook Payload Samples (Sanitized)

These are real examples captured from the Uniwire UI / resends. They reflect what our app actually receives on:

POST /api/uniwire/callback

## Common Top-Level Fields

All callback types include:

- callback_id (string)
- callback_status (string)
- signature (string)
- transaction (object) ✅ for transaction callbacks

In our app we treat transaction callbacks as the source of truth for deposits.

## Transaction Callback Statuses Observed

- transaction_pending
- transaction_confirmed
- transaction_complete

Note: When resending via UI, Uniwire may resend the latest state; always code defensively and update Deposit via upsert.

## Field Mapping (What we use in code)

From payload.transaction:

- Deposit key: transaction.id → Deposit.uniwireTransactionId (unique)
- tx hash: transaction.txid
- invoice id: transaction.invoice.id → Deposit.uniwireInvoiceId (NOT unique)
- address: transaction.invoice.address
- user link: transaction.invoice.passthrough (publicId)
- amount: transaction.amount.paid.amount
- asset: transaction.amount.paid.currency
- fiat value: transaction.amount.paid.quotes.USD → Deposit.fiatAmount (nullable, not confirmed present on every callback — see WEBHOOK_PAYLOADS examples below, which do show it)
- chain/network: prefer transaction.invoice.kind (e.g. "ETH")
- token-kind: transaction.kind can be token-specific (e.g. "ETH_USDT")

---

## Example 1 — transaction_pending

```json
{
  "callback_id": "0ba454c8-e233-4842-a427-f8ca87ee9154",
  "callback_status": "transaction_pending",
  "signature": "cf3b381d70cda86e3778ba434148f790ade1f35015f8695dfc14f7b7d62204a7",
  "transaction": {
    "id": "3b6d4d80-a5e6-4e69-86e0-3c8e042e2270",
    "kind": "ETH_USDT",
    "txid": "0xb861f8957c0896ae3102794174d6bd5e37f295343120c269e4857f7cc7e045ab",
    "invoice": {
      "id": "edd4122d-72a2-485f-87aa-150cf370094a",
      "kind": "ETH",
      "created_at": "2026-03-05T20:13:50.368613+00:00",
      "profile_id": "eb433f9f-77be-4acb-89b0-51ebfe71e17f",
      "address": "0x5c410D4CD8D98DAc882c6a3a9eCF40A952F88a5C",
      "lightning": null,
      "network": "testnet",
      "amount": {
        "requested": { "amount": "0", "currency": "USDT" },
        "invoiced": { "amount": "0", "currency": "ETH" }
      },
      "custom_fee": null,
      "min_confirmations": null,
      "zero_conf_enabled": null,
      "notes": null,
      "passthrough": "0001"
    },
    "amount": {
      "paid": { "amount": 75, "currency": "USDT", "quotes": { "USD": 75 } }
    },
    "currency_rates": { "USDT": { "USD": 1, "USDT": 1 } },
    "created_at": "2026-03-05T23:32:04.545802+00:00",
    "executed_at": null,
    "confirmed_at": null,
    "confirmations": 0,
    "status": "pending",
    "zero_conf_status": null,
    "network": "testnet",
    "risk_level": null,
    "risk_data": null,
    "sub_kind": null
  }
}

## Example 2 - transaction_confirmed

{
  "callback_id": "4b3e0803-21cc-41e7-aa9a-1830937e8705",
  "callback_status": "transaction_confirmed",
  "signature": "f033196521cfa687f5a0dd6a119fcbcab01f7eb9f175e2adf62e0d35b63e420e",
  "transaction": {
    "id": "3b6d4d80-a5e6-4e69-86e0-3c8e042e2270",
    "kind": "ETH_USDT",
    "txid": "0xb861f8957c0896ae3102794174d6bd5e37f295343120c269e4857f7cc7e045ab",
    "invoice": {
      "id": "edd4122d-72a2-485f-87aa-150cf370094a",
      "kind": "ETH",
      "created_at": "2026-03-05T20:13:50.368613+00:00",
      "profile_id": "eb433f9f-77be-4acb-89b0-51ebfe71e17f",
      "address": "0x5c410D4CD8D98DAc882c6a3a9eCF40A952F88a5C",
      "lightning": null,
      "network": "testnet",
      "amount": {
        "requested": { "amount": "0", "currency": "USDT" },
        "invoiced": { "amount": "0", "currency": "ETH" }
      },
      "custom_fee": null,
      "min_confirmations": null,
      "zero_conf_enabled": null,
      "notes": null,
      "passthrough": "0001"
    },
    "amount": {
      "paid": { "amount": 75, "currency": "USDT", "quotes": { "USD": 75 } }
    },
    "currency_rates": { "USDT": { "USD": 1, "USDT": 1 } },
    "created_at": "2026-03-05T23:32:04.545802+00:00",
    "executed_at": "2026-03-05T23:32:00+00:00",
    "confirmed_at": "2026-03-05T23:34:20.648032+00:00",
    "confirmations": 12,
    "status": "confirmed",
    "zero_conf_status": null,
    "network": "testnet",
    "risk_level": null,
    "risk_data": null,
    "sub_kind": null
  }
}


## Example 3 — transaction_complete

{
  "callback_id": "6bcbf334-f563-4b5c-9c3b-28cccbd31412",
  "callback_status": "transaction_complete",
  "signature": "a091da3e3bcd2e742ac9a6e9c813dbb5f30acebc68c84c8f89aa872f11a2179f",
  "transaction": {
    "id": "3b6d4d80-a5e6-4e69-86e0-3c8e042e2270",
    "kind": "ETH_USDT",
    "txid": "0xb861f8957c0896ae3102794174d6bd5e37f295343120c269e4857f7cc7e045ab",
    "invoice": {
      "id": "edd4122d-72a2-485f-87aa-150cf370094a",
      "kind": "ETH",
      "created_at": "2026-03-05T20:13:50.368613+00:00",
      "profile_id": "eb433f9f-77be-4acb-89b0-51ebfe71e17f",
      "address": "0x5c410D4CD8D98DAc882c6a3a9eCF40A952F88a5C",
      "lightning": null,
      "network": "testnet",
      "amount": {
        "requested": { "amount": "0", "currency": "USDT" },
        "invoiced": { "amount": "0", "currency": "ETH" }
      },
      "custom_fee": null,
      "min_confirmations": null,
      "zero_conf_enabled": null,
      "notes": null,
      "passthrough": "0001"
    },
    "amount": {
      "paid": { "amount": 75, "currency": "USDT", "quotes": { "USD": 75 } }
    },
    "currency_rates": { "USDT": { "USD": 1, "USDT": 1 } },
    "created_at": "2026-03-05T23:32:04.545802+00:00",
    "executed_at": "2026-03-05T23:32:00+00:00",
    "confirmed_at": "2026-03-05T23:34:20.648032+00:00",
    "confirmations": 35,
    "status": "complete",
    "zero_conf_status": null,
    "network": "testnet",
    "risk_level": null,
    "risk_data": null,
    "sub_kind": null
  }
}
```

## Invoice Creation Response (`POST /v1/invoices/`)

Captured live against the sandbox API — not a webhook callback, but the direct response to invoice creation, confirming the `amount.requested`/`amount.invoiced` shape referenced throughout `UNIWIRE_INTEGRATION.md` and `ARCHITECTURE_DECISIONS.md` (#16).

Request `{ profile_id, currency: "ETH", kind: "ETH", passthrough: "9999", amount: "0.001" }` (crypto-denominated ask):

```json
{
  "result": {
    "id": "3574afc0-2435-41c3-a850-2b494385aca7",
    "kind": "ETH",
    "created_at": "2026-07-06T20:06:30.276557+00:00",
    "profile_id": "eb433f9f-77be-4acb-89b0-51ebfe71e17f",
    "address": "0xF6c31e0B20aAB2d5c9131BeA5c35F4E46Fca967C",
    "status": "new",
    "expires_at": "2026-07-06T20:21:30.276323+00:00",
    "network": "testnet",
    "amount": {
      "requested": { "amount": "0.001", "currency": "ETH" },
      "invoiced": { "amount": "0.001", "currency": "ETH" }
    },
    "passthrough": "9999",
    "transactions": []
  }
}
```

Same request with `currency: "USD"` instead (fiat-denominated ask — `amount: "20"`):

```json
{
  "result": {
    "id": "7de6f799-7877-42b9-a2d1-8952ff78096a",
    "kind": "ETH",
    "created_at": "2026-07-06T20:06:31.226511+00:00",
    "profile_id": "eb433f9f-77be-4acb-89b0-51ebfe71e17f",
    "address": "0xcA7f3C9D1D9837f02D2a1a355Ffd90B5497F3a3A",
    "status": "new",
    "expires_at": "2026-07-06T20:21:31.226257+00:00",
    "network": "testnet",
    "amount": {
      "requested": { "amount": "20.00", "currency": "USD" },
      "invoiced": { "amount": "0.01118885", "currency": "ETH" }
    },
    "passthrough": "9999",
    "transactions": []
  }
}
```

Notes:

- `kind` is always the asset/network regardless of which currency `amount`/`currency` used
- `status` is the literal string `"new"` at creation, before any transaction activity — see Architecture Decision #17
- `expires_at` is exactly 15 minutes after `created_at` in both captures — not currently used by this app (see `DEPOSIT_FLOW.md`/`ARCHITECTURE_DECISIONS.md` Non-Goals), but available if invoice-expiry handling is ever added
- `amount.invoiced` is always crypto and is what this app stores as `Deposit.requestedAmount`; `amount.requested` mirrors the request's currency/amount and is stored as `Deposit.requestedFiatAmount` only when it's USD
