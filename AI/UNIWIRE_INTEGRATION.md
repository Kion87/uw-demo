# Uniwire Integration --- UW Demo

## References

https://docs.uniwire.com/api/quickstart

---

## Purpose

Uniwire handles:

- crypto deposit address creation
- blockchain monitoring
- transaction detection
- callback notifications

---

## Invoice Creation

Endpoint:

POST /v1/invoices

Payload example:

{ "profile_id": "...", "currency": "USDT", "kind": "TRX", "passthrough":
"0001" }

---

## Passthrough Field

The passthrough value contains:

user.publicId

Example:

"0001"

This allows webhook callbacks to identify which user initiated the
deposit.

---

## Response Formats

Uniwire may return two structures.

Format A:

{ result: {...} }

Format B:

{ content: { result: {...} } }

Always extract using:

const inv = response.result ?? response.content?.result

---

## Callback Endpoint

POST /api/uniwire/callback

This endpoint receives deposit confirmations.

Responsibilities:

1.  Verify Uniwire signature
2.  Ensure idempotent processing
3.  Identify user via passthrough
4.  Verify deposit address ownership
5.  Record deposit
6.  Credit user balance
7.  Return HTTP 200
