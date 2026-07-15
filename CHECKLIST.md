# OKX Finance Copilot — Hackathon Deliverables Checklist

## Infrastructure
- [ ] Public HTTPS URL live and responding (`GET /health` returns `{"status":"ok"}`)
- [ ] Zero unhandled exceptions in Render logs
- [ ] CORS permissive (any origin accepted)
- [ ] Rate limiter active (60 req/min/IP)
- [ ] Request ID echoed in response headers

## Endpoints
- [ ] `POST /v1/wallet-health` fully working (P0)
  - [ ] Returns 200 with score, riskLevel, factors, recommendation
  - [ ] Returns 400 on invalid EVM address
  - [ ] Returns 400 on unsupported chain
  - [ ] Returns partial: true when upstream partially fails
  - [ ] Returns 502 when ALL upstream calls fail (not 500)
- [ ] `POST /v1/yield-scan` working (P1)
  - [ ] Returns 200 with opportunities array and topPick
  - [ ] Returns 200 with empty opportunities (not 404) when no pools match
  - [ ] Returns 400 on missing asset field
  - [ ] Defaults apply (all chains, $1M TVL, balanced) when optional fields omitted
- [x] `POST /v1/tax-report` fully working (P2)
  - [x] Returns 200 with summary (realizedGainUsd, realizedLossUsd, netUsd) and transactions list
  - [x] Graceful fallback to deterministic mock when explorer API key is missing (ensures 100% testable/demo-safe out of the box)
  - [x] Returns 400 on malformed request (e.g. invalid date formats)

## Documentation
- [ ] `README.md` with curl examples for all 3 endpoints
- [ ] `docs/api-spec.md` with full endpoint contracts
- [ ] `docs/demo-script.md` ready for ≤90s video recording
- [ ] `CHECKLIST.md` (this file)
- [ ] `GET /manifest` returns ASP registration payload

## OKX Submission Reminders
- [ ] **Submit ASP listing on [okx.ai/tutorial/asp](https://okx.ai/tutorial/asp) EARLY**
      — Review takes up to 24h. Don't wait until everything is "perfect."
- [ ] **Post X (Twitter) thread** with `#OKXAI` hashtag + ≤90s demo video
- [ ] **Submit Google Form** with ASP details + X link before **July 17, 2026, 22:59–23:59 UTC**

## Final Smoke Test (run these before submitting)
```bash
BASE=https://<your-render-url>.onrender.com

# Health
curl $BASE/health

# Manifest
curl $BASE/manifest

# P0: Valid token
curl -X POST $BASE/v1/wallet-health \
  -H "Content-Type: application/json" \
  -d '{"address":"0xdAC17F958D2ee523a2206206994597C13D831ec7","chain":"ethereum"}'

# P0: Bad address → expect 400
curl -X POST $BASE/v1/wallet-health \
  -H "Content-Type: application/json" \
  -d '{"address":"not-an-address","chain":"ethereum"}'

# P0: Unsupported chain → expect 400
curl -X POST $BASE/v1/wallet-health \
  -H "Content-Type: application/json" \
  -d '{"address":"0xdAC17F958D2ee523a2206206994597C13D831ec7","chain":"solana"}'

# P1: USDT yield scan
curl -X POST $BASE/v1/yield-scan \
  -H "Content-Type: application/json" \
  -d '{"asset":"USDT","chains":["ethereum","bsc"],"minTvlUsd":1000000,"riskTolerance":"balanced"}'

# P1: Missing asset → expect 400
curl -X POST $BASE/v1/yield-scan \
  -H "Content-Type: application/json" \
  -d '{"chains":["ethereum"]}'

# P2: Tax report → expect 200
curl -X POST $BASE/v1/tax-report \
  -H "Content-Type: application/json" \
  -d '{"address":"0xdAC17F958D2ee523a2206206994597C13D831ec7","chain":"ethereum","fromDate":"2025-01-01","toDate":"2025-12-31"}'
```
