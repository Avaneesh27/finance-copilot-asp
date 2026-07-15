# OKX Finance Copilot — API Specification

**Base URL:** `https://<your-render-url>.onrender.com`
**Version:** `1.0.0`
**Content-Type:** `application/json` (all endpoints)

---

## Shared Error Envelope

All errors (4xx, 5xx) return this shape:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable description of what went wrong."
  }
}
```

**Error codes:**

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed or invalid request body |
| `UNSUPPORTED_CHAIN` | 400 | Chain not in supported list |
| `RATE_LIMITED` | 429 | Exceeded 60 req/min per IP |
| `UPSTREAM_ERROR` | 502 | All upstream APIs failed |
| `NOT_FOUND` | 404 | Endpoint does not exist |
| `METHOD_NOT_ALLOWED` | 405 | Non-POST request to a POST-only endpoint |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## GET /health

Health check — no rate limit, no auth.

**Response 200:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2026-07-16T01:00:00.000Z"
}
```

---

## GET /manifest

ASP registration payload for OKX agent wallet flow.

**Response 200:**
```json
{
  "name": "OKX Finance Copilot",
  "version": "1.0.0",
  "description": "Financial due-diligence ASP: wallet security scoring, stablecoin yield scanning, and on-chain tax activity reporting.",
  "category": "finance",
  "supportedChains": ["ethereum", "bsc", "polygon", "arbitrum", "xlayer"],
  "pricingModel": "free-tier-mvp",
  "pricingNote": "Planned x402 micropayment pricing per endpoint — free during hackathon MVP.",
  "disclaimer": "Informational only. Not financial, tax, or legal advice.",
  "endpoints": [...]
}
```

---

## POST /v1/wallet-health

**Purpose:** Returns a 0-100 security health score for any EVM wallet or token contract address.

**Data source:** GoPlus Security API (token_security + address_security)

**Pricing:** Free tier now · Planned $0.02/call via x402 micropayment

### Request

```json
{
  "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "chain": "ethereum"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string | ✅ | EVM address: `0x` + 40 hex chars |
| `chain` | string | ✅ | One of: `ethereum`, `bsc`, `polygon`, `arbitrum`, `xlayer` |

### Response 200

```json
{
  "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "chain": "ethereum",
  "score": 85,
  "riskLevel": "low",
  "factors": [
    {
      "name": "contract_verified",
      "status": "pass",
      "detail": "Source code verified and publicly readable on block explorer."
    },
    {
      "name": "honeypot_check",
      "status": "pass",
      "detail": "No honeypot signals detected by GoPlus simulation."
    },
    {
      "name": "holder_concentration",
      "status": "warning",
      "detail": "Top holder controls 18.4% — moderate concentration risk.",
      "topHolderPct": 18.4
    },
    {
      "name": "liquidity_depth",
      "status": "pass",
      "detail": "$4.20M total DEX liquidity — strong depth.",
      "usd": 4200000
    },
    {
      "name": "malicious_approval_exposure",
      "status": "pass",
      "detail": "No malicious activity flags found in GoPlus address database.",
      "count": 0
    },
    {
      "name": "blacklist_status",
      "status": "pass",
      "detail": "Address is not on any known blacklists."
    }
  ],
  "recommendation": "This address looks generally safe (score 85/100)...",
  "partial": false,
  "dataSource": ["GoPlus Security API"],
  "disclaimer": "Informational only. Not tax, legal, or financial advice.",
  "pricingNote": "Planned: $0.02/call via x402 micropayment — free during hackathon MVP.",
  "generatedAt": "2026-07-16T01:00:00.000Z"
}
```

**Score rubric:**

| Factor | Pass pts | Warn pts | Fail pts | Notes |
|---|---|---|---|---|
| `contract_verified` | 20 | 10 | 0 | `is_open_source` from GoPlus |
| `honeypot_check` | 25 | 0 | 0 | Honeypot → total score capped at 20 |
| `holder_concentration` | 20 | 10 | 0 | Top holder % |
| `liquidity_depth` | 15 | 8 | 0 | Sum of DEX liquidity in USD |
| `malicious_approval_exposure` | 10 | 5 | 0 | GoPlus address security flags |
| `blacklist_status` | 10 | 0 | 0 | `is_blacklisted` from GoPlus |

**Risk levels:**

| Score | riskLevel |
|---|---|
| ≥ 75 | `low` |
| 50–74 | `medium` |
| 25–49 | `high` |
| < 25 | `critical` |

**`partial: true`** is set when one or more upstream signals fail. Score reflects only available data.

### Errors

| Condition | Status | Code |
|---|---|---|
| Invalid EVM address format | 400 | `VALIDATION_ERROR` |
| Unsupported chain | 400 | `VALIDATION_ERROR` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| All upstream APIs failed | 502 | `UPSTREAM_ERROR` |

---

## POST /v1/yield-scan

**Purpose:** Scans DeFi protocols for the best risk-adjusted stablecoin yield opportunities.

**Data source:** DeFiLlama Yields API (`yields.llama.fi/pools`) — no API key required.

**Pricing:** Free tier now · Planned $0.01/call via x402 micropayment

### Request

```json
{
  "asset": "USDT",
  "chains": ["ethereum", "bsc"],
  "minTvlUsd": 1000000,
  "riskTolerance": "balanced"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `asset` | string | ✅ | — | Asset symbol to search (e.g. `USDT`, `USDC`, `DAI`). Case-insensitive. |
| `chains` | string[] | ❌ | all supported | Filter to specific chains |
| `minTvlUsd` | number | ❌ | `1000000` | Minimum pool TVL in USD |
| `riskTolerance` | string | ❌ | `balanced` | `conservative` \| `balanced` \| `aggressive` |

### Response 200

```json
{
  "asset": "USDT",
  "filters": {
    "chains": ["ethereum", "bsc"],
    "minTvlUsd": 1000000,
    "riskTolerance": "balanced"
  },
  "opportunities": [
    {
      "protocol": "Aave V3",
      "chain": "Ethereum",
      "apy": 4.2,
      "tvlUsd": 812000000,
      "type": "lending",
      "riskNotes": "Blue-chip protocol with $1B+ TVL",
      "url": "https://app.aave.com/...",
      "symbol": "USDT"
    }
  ],
  "topPick": { "...": "same shape as opportunities[0]" },
  "dataSource": ["DeFiLlama Yields API"],
  "disclaimer": "Informational only...",
  "pricingNote": "Planned: $0.01/call via x402 micropayment — free during hackathon MVP.",
  "generatedAt": "2026-07-16T01:00:00.000Z"
}
```

**Ranking algorithm:**

```
score = apy × log₁₀(tvlUsd / minTvlUsd + 1)
```

Risk tolerance adjustments:
- `conservative`: score ÷ 1.5 if TVL < $50M
- `balanced`: score ÷ 1.2 if TVL < $10M
- `aggressive`: no downweight

Returns top 10 results sorted by score descending.

**`opportunities: []`** with HTTP 200 (not 404) when no pools match criteria.

### Errors

| Condition | Status | Code |
|---|---|---|
| Missing or empty `asset` field | 400 | `VALIDATION_ERROR` |
| Invalid `riskTolerance` value | 400 | `VALIDATION_ERROR` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| DeFiLlama API failed | 502 | `UPSTREAM_ERROR` |

---

## POST /v1/tax-report

**Purpose:** Generates an on-chain tax/activity report with FIFO cost basis calculation.

**Status:** Under development — returns HTTP 501 in current MVP.

**Pricing:** Free tier now · Planned $0.05/report via x402 micropayment

### Request

```json
{
  "address": "0xYourWalletAddress",
  "chain": "ethereum",
  "fromDate": "2025-01-01",
  "toDate": "2025-12-31",
  "costBasisMethod": "FIFO"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `address` | string | ✅ | — | EVM wallet address |
| `chain` | string | ✅ | — | One of supported chains |
| `fromDate` | string | ✅ | — | Start date `YYYY-MM-DD` |
| `toDate` | string | ✅ | — | End date `YYYY-MM-DD` |
| `costBasisMethod` | string | ❌ | `FIFO` | `FIFO` \| `LIFO` |

### Response 501 (current stub)

```json
{
  "status": "coming_soon",
  "message": "Tax report endpoint is under active development and will launch post-hackathon...",
  "plannedFeatures": ["..."],
  "pricingNote": "Planned: $0.05/report via x402 micropayment — free during hackathon MVP.",
  "disclaimer": "Informational only...",
  "generatedAt": "2026-07-16T01:00:00.000Z"
}
```

### Response 200 (planned — not yet live)

```json
{
  "address": "0x...",
  "period": { "from": "2025-01-01", "to": "2025-12-31" },
  "costBasisMethod": "FIFO",
  "summary": {
    "totalTransactions": 142,
    "realizedGainUsd": 1820.50,
    "realizedLossUsd": -340.20,
    "netUsd": 1480.30
  },
  "transactions": ["...line items..."],
  "disclaimer": "Informational only. Not tax, legal, or financial advice — consult a professional.",
  "pricingNote": "Planned: $0.05/report via x402 micropayment.",
  "generatedAt": "2026-07-16T01:00:00.000Z"
}
```

### Errors

| Condition | Status | Code |
|---|---|---|
| Invalid address / missing required field | 400 | `VALIDATION_ERROR` |
| Invalid date format | 400 | `VALIDATION_ERROR` |
| Rate limit exceeded | 429 | `RATE_LIMITED` |
| Endpoint not yet implemented | 501 | — (`status: "coming_soon"`) |
