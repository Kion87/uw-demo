# Architecture Decisions --- UW Demo

This file records important design decisions made during development.

------------------------------------------------------------------------

## Address Reuse Per Blockchain

Decision: Deposit addresses are reused per blockchain network.

Reason: Tokens on the same blockchain share the same address format.

Examples:

ETH address supports: - ETH - USDT ERC20 - USDC ERC20

TRX address supports: - TRX - USDT TRC20

Benefits:

-   fewer invoices
-   simpler address management
-   more realistic exchange/casino behavior

------------------------------------------------------------------------

## Passthrough User Identification

Decision: Use Uniwire passthrough field to store user.publicId.

Reason: Allows webhook callbacks to link deposits to users without
complex mapping.

Example:

"passthrough": "0001"

------------------------------------------------------------------------

## Cookie Session Authentication

Decision: Use cookie sessions instead of JWT.

Reason:

-   simpler implementation
-   secure server-side sessions
-   good fit for Nuxt server routes

------------------------------------------------------------------------

## Server Architecture

Backend implemented using:

Nuxt server routes (Nitro)

Reason:

-   simple API layer
-   works well with Netlify functions
-   avoids separate backend server
