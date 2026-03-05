# UW Demo --- Database Schema

## User

id Int (primary key) publicId String email String

Used for identifying users and linking Uniwire passthrough values.

## Session

token String userId Int expiresAt DateTime

Used for cookie session authentication.

## DepositAddress

userId Int assetKey String invoiceId String address String

Stores reusable blockchain deposit addresses.

Unique constraint:

(userId, assetKey)

## Deposit

userId Int asset String network String amount Decimal uniwireInvoiceId
String address String status String

Example statuses:

pending confirmed failed
