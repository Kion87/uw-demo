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
