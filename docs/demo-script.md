# OKX Finance Copilot — Demo Script
## ≤90 Second Video Shot List

---

### Shot 1 — Problem Statement (0–12s)

**Visual:** Screen showing a chat interface where an AI agent is asked:
*"Is this wallet safe to send funds to? And where can I get the best USDT yield?"*

**Narration (VO):**
> "AI agents making financial decisions need fast, structured security and yield data —
> not a web page to browse, but a single JSON call with a single JSON answer.
> That's OKX Finance Copilot."

**Cut to:** Terminal window

---

### Shot 2 — Live curl: Wallet Health (12–42s)

**Visual:** Terminal. Run this command live (pre-warm the endpoint):

```bash
curl -s -X POST https://<YOUR-URL>.onrender.com/v1/wallet-health \
  -H "Content-Type: application/json" \
  -d '{"address":"0xdAC17F958D2ee523a2206206994597C13D831ec7","chain":"ethereum"}' \
  | jq '{score,riskLevel,recommendation,partial}'
```

**Expected output on screen:**
```json
{
  "score": 85,
  "riskLevel": "low",
  "recommendation": "This address passed all security checks with no major red flags.",
  "partial": false
}
```

**Narration:**
> "One POST call. In under a second, the agent gets a 0-to-100 security score,
> a risk level, and a plain-language recommendation — sourced from GoPlus Security,
> no hallucination, all public blockchain data."

---

### Shot 3 — Live curl: Yield Scan (42–68s)

**Visual:** Same terminal. Run:

```bash
curl -s -X POST https://<YOUR-URL>.onrender.com/v1/yield-scan \
  -H "Content-Type: application/json" \
  -d '{"asset":"USDT","chains":["ethereum","bsc"],"riskTolerance":"balanced"}' \
  | jq '{topPick: .topPick | {protocol,chain,apy,tvlUsd,riskNotes}}'
```

**Expected output:**
```json
{
  "topPick": {
    "protocol": "Aave V3",
    "chain": "Ethereum",
    "apy": 4.2,
    "tvlUsd": 812000000,
    "riskNotes": "Blue-chip protocol with $1B+ TVL"
  }
}
```

**Narration:**
> "Same pattern for DeFi yield. The agent asks for USDT opportunities,
> gets back a ranked list from DeFiLlama with risk-adjusted scoring —
> APY weighted by TVL depth so it doesn't blindly chase yield on a $50k pool."

---

### Shot 4 — Tax Report Stub + What's Next (68–82s)

**Visual:** Show the 501 response briefly:

```bash
curl -s -X POST https://<YOUR-URL>.onrender.com/v1/tax-report \
  -H "Content-Type: application/json" \
  -d '{"address":"0xdAC17F958D2ee523a2206206994597C13D831ec7","chain":"ethereum","fromDate":"2025-01-01","toDate":"2025-12-31"}' \
  | jq '{status,message}'
```

```json
{
  "status": "coming_soon",
  "message": "Tax report endpoint is under active development..."
}
```

**Narration:**
> "Tax reporting is next — the endpoint is spec'd, the request schema is live,
> and it gracefully returns a 501 instead of failing silently."

---

### Shot 5 — OKX ASP Listing (82–90s)

**Visual:** Browser showing the OKX ASP listing page (or the manifest JSON).

**Narration:**
> "OKX Finance Copilot is registered as a Finance ASP on OKX.AI —
> any agent on the platform can discover and call it today.
> Built for the OKX.AI Genesis Hackathon."

---

## Recording Tips

- **Pre-warm the endpoint** before recording — hit `/health` to wake it from Render sleep.
- Use `jq` to pretty-print JSON (install: `brew install jq` / `sudo apt install jq`).
- Run commands at a **relaxed pace** — pause after each response appears so viewers can read.
- Use a **dark terminal** (iTerm2, Windows Terminal) with large font for readability.
- Record at **1920×1080** minimum.
- Post as unlisted YouTube or direct MP4 (≤90s), then link in your X thread.

## X Thread Template

```
🚀 Introducing OKX Finance Copilot — a Finance ASP for AI agents on OKX.AI

✅ Wallet Security Score (0-100, powered by GoPlus)
✅ Stablecoin Yield Scanner (risk-adjusted APY via DeFiLlama)
🔜 On-chain Tax Report (FIFO cost basis, coming soon)

One JSON call → one JSON answer. No hallucinations, all public chain data.

Demo ↓

[video link]

#OKXAI #OKXHackathon #DeFi #AI
```
