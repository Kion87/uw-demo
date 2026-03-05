# Deposit Flow --- UW Demo

## Overview

This document explains how crypto deposits are created and processed in
the UW Demo system.

The system simulates a casino/broker deposit flow using Uniwire
invoices.

Users: 1. Generate a deposit address 2. Send crypto 3. Receive credited
balance after webhook confirmation

------------------------------------------------------------------------

## Deposit Creation Endpoint

POST /api/deposit

Payload:

{ "assetKey": "USDT_TRC20" }

------------------------------------------------------------------------

## Address Reuse Principle

Deposit addresses are reused per blockchain network.

Examples:

ETH address supports: - ETH - USDT ERC20 - USDC ERC20

TRX address supports: - TRX - USDT TRC20

SOL address supports: - SOL - SPL tokens

------------------------------------------------------------------------

## Address Reuse Logic

reuseKey = assetConfig.kind

Example values:

ETH TRX SOL BTC

Lookup order:

1.  (userId, reuseKey)
2.  fallback (userId, assetKey)

------------------------------------------------------------------------

## Address Creation

If address does not exist:

1.  Create Uniwire invoice
2.  Store returned address
3.  Save DepositAddress record
4.  Return address to frontend

------------------------------------------------------------------------

## Uniwire Invoice

POST /v1/invoices

Payload:

profile_id currency kind passthrough

passthrough contains user.publicId.

------------------------------------------------------------------------

## Response Parsing

Uniwire responses may appear as:

{ result: {...} }

or

{ content: { result: {...} } }

Always extract using:

const inv = response.result ?? response.content?.result
