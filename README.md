# OKX Finance Copilot ASP

> **A multi-service Agent Service Provider for AI-driven financial due diligence.**
> Built for the OKX.AI Genesis Hackathon.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## What It Does

OKX Finance Copilot exposes three standardized, pay-per-call–shaped A2MCP endpoints
that give any AI agent fast, structured financial intelligence:

| Endpoint | What it answers | Status |
|---|---|---|
| `POST /v1/wallet-health` | Is this token/wallet address safe? | ✅ Live |
| `POST /v1/yield-scan` | Where's the best stablecoin yield right now? | ✅ Live |
| `POST /v1/tax-report` | What does my on-chain tax activity look like? | ✅ Live |

Every endpoint returns a single JSON response — no multi-turn negotiation, no auth beyond
what A2MCP requires, and includes a `pricingNote` field showing the intended x402
micropayment price when monetization is activated.

---

## Live Endpoint

```
https://<your-render-url>.onrender.com
```

Replace with your actual Render URL after deployment.

```bash
# Health check
curl https://<your-render-url>.onrender.com/health

# ASP manifest (for OKX registration)
curl https://<your-render-url>.onrender.com/manifest
```

---

## Quickstart — curl Examples

### P0: Wallet & Token Security Health Score

Check whether a token contract is safe (uses USDT on Ethereum as example):

```bash
curl -s -X POST https://<your-render-url>.onrender.com/v1/wallet-health \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "chain": "ethereum"
  }' | jq .
```

**Expected response:**
```json
{
  "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "chain": "ethereum",
  "score": 85,
  "riskLevel": "low",
  "factors": [
    { "name": "contract_verified", "status": "pass", "detail": "Source code verified and publicly readable on block explorer." },
    { "name": "honeypot_check", "status": "pass", "detail": "No honeypot signals detected by GoPlus simulation." },
    { "name": "holder_concentration", "status": "warning", "topHolderPct": 18.4 },
    { "name": "liquidity_depth", "status": "pass", "usd": 42000000 },
    { "name": "malicious_approval_exposure", "status": "pass", "count": 0 },
    { "name": "blacklist_status", "status": "pass" }
  ],
  "recommendation": "This address looks generally safe (score 85/100) ...",
  "partial": false,
  "dataSource": ["GoPlus Security API"],
  "disclaimer": "Informational only. Not financial, tax, or legal advice.",
  "pricingNote": "Planned: $0.02/call via x402 micropayment — free during hackathon MVP.",
  "generatedAt": "2026-07-16T01:00:00.000Z"
}
```

Supported chains: `ethereum` | `bsc` | `polygon` | `arbitrum` | `xlayer`

**Error cases:**
```bash
# Bad address → 400
curl -X POST .../v1/wallet-health -H "Content-Type: application/json" \
  -d '{"address": "not-an-address", "chain": "ethereum"}'

# Unsupported chain → 400
curl -X POST .../v1/wallet-health -H "Content-Type: application/json" \
  -d '{"address": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "chain": "solana"}'
```

---

### P1: Stablecoin Yield Scanner

Find the best USDT yield opportunities:

```bash
curl -s -X POST https://<your-render-url>.onrender.com/v1/yield-scan \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "USDT",
    "chains": ["ethereum", "bsc"],
    "minTvlUsd": 1000000,
    "riskTolerance": "balanced"
  }' | jq .
```

All fields except `asset` are optional (defaults: all chains, $1M TVL, balanced):

```bash
# Minimal request
curl -X POST .../v1/yield-scan \
  -H "Content-Type: application/json" \
  -d '{"asset": "USDC"}'
```

**Expected response shape:**
```json
{
  "asset": "USDT",
  "filters": { "chains": ["ethereum", "bsc"], "minTvlUsd": 1000000, "riskTolerance": "balanced" },
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
  "pricingNote": "Planned: $0.01/call via x402 micropayment...",
  "generatedAt": "2026-07-16T01:00:00.000Z"
}
```

---

### P2: Tax Report

```bash
curl -s -X POST https://<your-render-url>.onrender.com/v1/tax-report \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "chain": "ethereum",
    "fromDate": "2025-01-01",
    "toDate": "2025-12-31",
    "costBasisMethod": "FIFO"
  }' | jq .
```

**Expected response:**
```json
{
  "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "period": { "from": "2025-01-01", "to": "2025-12-31" },
  "summary": {
    "totalTransactions": 14,
    "realizedGainUsd": 1284.50,
    "realizedLossUsd": -120.40,
    "netUsd": 1164.10
  },
  "transactions": [
    {
      "txHash": "0x123...",
      "timestamp": "2025-06-15T10:30:00.000Z",
      "asset": "ETH",
      "amount": 0.5,
      "type": "send",
      "priceUsd": 3200.00,
      "totalUsd": 1600.00,
      "feeUsd": 8.50,
      "realizedGainLossUsd": 450.00
    }
  ],
  "dataSource": ["Deterministic Simulated Data"],
  "disclaimer": "Informational only. Not tax, legal, or financial advice — consult a professional.",
  "pricingNote": "Planned: $0.05/report via x402 micropayment — free during hackathon MVP.",
  "generatedAt": "2026-07-16T01:00:00.000Z"
}
```

If `ETHERSCAN_API_KEY` is set as an env var, the endpoint retrieves actual block explorer history and queries DeFiLlama Coins API to compute historical cost basis. Otherwise, it gracefully falls back to deterministic simulated transactions to ensure it is 100% demo-safe.

---

## Architecture

```
OKX Agent  ──POST JSON──►  Express (Node 20 + TS)
                              │
                   ┌──────────┴──────────┐
                   │   Middleware Stack   │
                   │  requestId → pino   │
                   │  rateLimiter (60/m) │
                   │  zod validation     │
                   └──────────┬──────────┘
                              │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
     /wallet-health      /yield-scan        /tax-report
            │                  │                  │
     GoPlus API         DeFiLlama API      Etherscan API /
     (token+addr        (yields.llama.fi)  Mock Simulator
      security)
            │                  │                  │
     scoring.ts         rank.ts            costBasis.ts
     0-100 score        risk-adjusted APY  FIFO Tax Engine
```

**Design principles:**
- 5s hard timeout on every upstream call (axios `timeout` option)
- 60s LRU cache on all upstream responses (survives repeated demo calls)
- `Promise.allSettled` for parallel upstream calls — one failure = partial result, not 500
- Zod validates all inputs before any external API is touched
- Every response includes `disclaimer` and `pricingNote`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port (Render injects this automatically) |
| `GOPLUS_API_KEY` | No | — | GoPlus API key. Free tier works without one; key increases rate limits. |
| `ETHERSCAN_API_KEY` | No | — | Required only for /v1/tax-report full implementation. |
| `LOG_LEVEL` | No | `info` | Pino log level: `trace\|debug\|info\|warn\|error` |
| `RATE_LIMIT_RPM` | No | `60` | Requests per minute per IP |
| `CACHE_TTL_MS` | No | `60000` | Cache TTL in milliseconds |
| `PUBLIC_URL` | No | — | Set to your Render URL for accurate manifest endpoint URLs |

---

## Deployment

### Render (recommended — free tier, auto HTTPS)

1. Fork/push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo — Render auto-detects `render.yaml`
4. Set `GOPLUS_API_KEY` in the Render dashboard (optional but recommended)
5. Deploy → get your `https://<service>.onrender.com` URL

> ⚠️ Render free tier sleeps after 15 min of inactivity. First request may take ~30s to warm up.
> Use the `/health` endpoint as a keep-alive ping if needed.

### Local Development

```bash
git clone <repo>
cd finance-copilot-asp
npm install
cp .env.example .env  # fill in API keys if you have them
npm run dev           # starts on http://localhost:3000 with hot reload
```

### Production Build

```bash
npm run build   # compiles src/ → dist/
npm start       # runs dist/server.js
```

---

## Testing

```bash
npm test        # runs vitest in run mode (CI-friendly, no watch)
npm run test:watch  # watch mode for development
```

Tests cover:
- `test/walletHealth.test.ts` — scoring engine: clean/honeypot/partial/malicious cases
- `test/yieldScan.test.ts` — ranking: asset filter, TVL filter, chain filter, empty results

---

## Supported Chains

| ID | Name | GoPlus Chain ID | DeFiLlama Name |
|---|---|---|---|
| `ethereum` | Ethereum | 1 | Ethereum |
| `bsc` | BNB Smart Chain | 56 | BSC |
| `polygon` | Polygon | 137 | Polygon |
| `arbitrum` | Arbitrum One | 42161 | Arbitrum |
| `xlayer` | X Layer (OKX) | 196 | X Layer |

---

## OKX ASP Registration

1. Navigate to [okx.ai/tutorial/asp](https://okx.ai/tutorial/asp) with your Agentic Wallet
2. Use `GET /manifest` from your live URL to get the pre-filled registration payload
3. Submit early — review takes up to 24h

---

## Disclaimer

All outputs from this service are **informational only** and do not constitute financial,
tax, legal, or investment advice. Always consult a qualified professional before making
financial decisions.
