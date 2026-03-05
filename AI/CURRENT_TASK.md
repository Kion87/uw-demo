# Current Task --- UW Demo

## Task

Webhook receives transaction callbacks and stores deposits

Next: credit user balance safely

---

## Requirements

Webhook must:

1.  Verify Uniwire signature
2.  Parse webhook payload
3.  Ensure idempotent processing
4.  Identify user via passthrough
5.  Verify deposit address ownership
6.  Insert Deposit record
7.  Credit user balance
8.  Return HTTP 200

---

## Goal

Ensure deposits detected by Uniwire correctly credit the user balance in
the UW Demo system.
