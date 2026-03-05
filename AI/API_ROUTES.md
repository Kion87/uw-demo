# API Routes --- UW Demo

## Authentication

POST /api/signup Creates user account.

POST /api/logout Logs out user and deletes session.

GET /api/me Returns current authenticated user.

------------------------------------------------------------------------

## Deposits

POST /api/deposit

Creates or returns a deposit address.

Payload:

{ assetKey }

Example:

{ "assetKey": "USDT_TRC20" }

------------------------------------------------------------------------

## Uniwire Webhook

POST /api/uniwire/callback

Receives deposit notifications from Uniwire.

Tasks:

-   verify signature
-   idempotent processing
-   identify user via passthrough
-   verify address ownership
-   create deposit record
-   credit user balance
-   return HTTP 200
