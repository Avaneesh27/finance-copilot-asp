import { Factor, FactorStatus, RiskLevel, FINANCIAL_DISCLAIMER, PRICING_NOTES } from '../../lib/schema.js';
import type { GoPlusTokenData, GoPlusAddressData } from './goplus.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreResult {
  score: number;
  riskLevel: RiskLevel;
  factors: Factor[];
  partial: boolean;
  recommendation: string;
  disclaimer: string;
  pricingNote: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flag(raw: string | undefined): 'yes' | 'no' | 'unknown' {
  if (raw === '1') return 'yes';
  if (raw === '0') return 'no';
  return 'unknown';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'low';
  if (score >= 50) return 'medium';
  if (score >= 25) return 'high';
  return 'critical';
}

// ─── Scoring rubric ───────────────────────────────────────────────────────────
//
//  Factor                    Pass  Warn  Fail   Notes
//  ─────────────────────────────────────────────────────
//  contract_verified          20    10     0    is_open_source
//  honeypot_check             25     -     -    honeypot → score cap at 20
//  holder_concentration       20    10     0    top holder %
//  liquidity_depth            15     8     0    sum of DEX liquidity
//  malicious_approval_exp.    10     5     0    address security flags
//  blacklist_status           10     0     0    is_blacklisted
//  ─────────────────────────────────────────────────────
//  Total max                 100

/**
 * Converts raw GoPlus API data into a structured health score.
 * Either tokenData or addressData (or both) may be null — in that case
 * the affected factors are omitted and partial is set to true.
 */
export function buildHealthScore(
  tokenData: GoPlusTokenData | null,
  addressData: GoPlusAddressData | null,
): ScoreResult {
  const factors: Factor[] = [];
  let score = 0;
  let partial = false;
  let honeypotDetected = false;

  // ── 1. contract_verified (20 pts) ─────────────────────────────────────────
  if (tokenData !== null) {
    const openSource = flag(tokenData.is_open_source);
    if (openSource === 'yes') {
      score += 20;
      factors.push({
        name: 'contract_verified',
        status: 'pass',
        detail: 'Source code verified and publicly readable on block explorer.',
      });
    } else if (openSource === 'no') {
      // No points
      factors.push({
        name: 'contract_verified',
        status: 'fail',
        detail: 'Contract source code is not verified — cannot inspect logic.',
      });
    } else {
      // unknown — warn, partial credit
      score += 10;
      factors.push({
        name: 'contract_verified',
        status: 'warning',
        detail: 'Verification status unknown — treat with caution.',
      });
      partial = true;
    }
  } else {
    partial = true;
  }

  // ── 2. honeypot_check (25 pts / score cap) ────────────────────────────────
  if (tokenData !== null) {
    const isHoneypot = flag(tokenData.is_honeypot);
    const sameCreatorHoneypot = flag(tokenData.honeypot_with_same_creator);

    if (isHoneypot === 'yes' || sameCreatorHoneypot === 'yes') {
      honeypotDetected = true;
      factors.push({
        name: 'honeypot_check',
        status: 'fail',
        detail: 'Honeypot signals detected — funds may be trapped and unwithdrawable.',
      });
    } else if (isHoneypot === 'no') {
      score += 25;
      factors.push({
        name: 'honeypot_check',
        status: 'pass',
        detail: 'No honeypot signals detected by GoPlus simulation.',
      });
    } else {
      // unknown
      score += 12;
      partial = true;
      factors.push({
        name: 'honeypot_check',
        status: 'warning',
        detail: 'Honeypot status could not be determined — proceed cautiously.',
      });
    }
  } else {
    partial = true;
  }

  // ── 3. holder_concentration (20 pts) ─────────────────────────────────────
  if (tokenData?.holders && tokenData.holders.length > 0) {
    const topHolder = tokenData.holders[0];
    const topPct = parseFloat(topHolder?.percent ?? '0') * 100;

    let status: FactorStatus;
    let pts: number;
    let detail: string;

    if (topPct < 10) {
      status = 'pass';
      pts = 20;
      detail = `Top holder controls ${topPct.toFixed(1)}% — well-distributed supply.`;
    } else if (topPct <= 25) {
      status = 'warning';
      pts = 10;
      detail = `Top holder controls ${topPct.toFixed(1)}% — moderate concentration risk.`;
    } else {
      status = 'fail';
      pts = 0;
      detail = `Top holder controls ${topPct.toFixed(1)}% — high concentration risk.`;
    }

    score += pts;
    factors.push({
      name: 'holder_concentration',
      status,
      detail,
      topHolderPct: parseFloat(topPct.toFixed(2)),
    });
  } else if (tokenData !== null) {
    // tokenData present but no holders array
    partial = true;
    factors.push({
      name: 'holder_concentration',
      status: 'warning',
      detail: 'Holder data unavailable from GoPlus for this address.',
    });
  } else {
    partial = true;
  }

  // ── 4. liquidity_depth (15 pts) ───────────────────────────────────────────
  if (tokenData?.dex && tokenData.dex.length > 0) {
    const totalLiquidityUsd = tokenData.dex.reduce((sum, d) => {
      const liq = parseFloat(d.liquidity ?? '0');
      return sum + (isNaN(liq) ? 0 : liq);
    }, 0);

    let status: FactorStatus;
    let pts: number;
    let detail: string;

    if (totalLiquidityUsd >= 500_000) {
      status = 'pass';
      pts = 15;
      detail = `$${(totalLiquidityUsd / 1_000_000).toFixed(2)}M total DEX liquidity — strong depth.`;
    } else if (totalLiquidityUsd >= 100_000) {
      status = 'warning';
      pts = 8;
      detail = `$${(totalLiquidityUsd / 1_000).toFixed(0)}K DEX liquidity — moderate, watch for slippage.`;
    } else {
      status = 'fail';
      pts = 0;
      detail = `$${(totalLiquidityUsd / 1_000).toFixed(0)}K DEX liquidity — very low, high slippage risk.`;
    }

    score += pts;
    factors.push({
      name: 'liquidity_depth',
      status,
      detail,
      usd: Math.round(totalLiquidityUsd),
    });
  } else if (tokenData !== null && (!tokenData.dex || tokenData.dex.length === 0)) {
    factors.push({
      name: 'liquidity_depth',
      status: 'warning',
      detail: 'No DEX liquidity pools found for this token.',
      usd: 0,
    });
  } else {
    partial = true;
  }

  // ── 5. malicious_approval_exposure (10 pts) ───────────────────────────────
  if (addressData !== null) {
    const maliciousFlags = [
      addressData.blackmail_activities,
      addressData.cybercrime,
      addressData.darkweb_transactions,
      addressData.financial_crime,
      addressData.honeypot_related_address,
      addressData.malicious_contract_creation,
      addressData.money_laundering,
      addressData.phishing_activities,
      addressData.stealing_attack,
    ].filter((v) => v === '1').length;

    const count = parseInt(addressData.number_of_malicious_contracts_created ?? '0', 10);
    const totalSignals = maliciousFlags + (isNaN(count) ? 0 : count);

    if (totalSignals === 0) {
      score += 10;
      factors.push({
        name: 'malicious_approval_exposure',
        status: 'pass',
        detail: 'No malicious activity flags found in GoPlus address database.',
        count: 0,
      });
    } else if (totalSignals <= 2) {
      score += 5;
      factors.push({
        name: 'malicious_approval_exposure',
        status: 'warning',
        detail: `${totalSignals} malicious activity flag(s) detected — review before transacting.`,
        count: totalSignals,
      });
    } else {
      factors.push({
        name: 'malicious_approval_exposure',
        status: 'fail',
        detail: `${totalSignals} malicious activity flags detected — high risk address.`,
        count: totalSignals,
      });
    }
  } else {
    partial = true;
    // Give partial benefit of the doubt
    score += 5;
    factors.push({
      name: 'malicious_approval_exposure',
      status: 'warning',
      detail: 'Malicious approval exposure check unavailable — address security lookup failed.',
      count: 0,
    });
  }

  // ── 6. blacklist_status (10 pts) ──────────────────────────────────────────
  if (tokenData !== null) {
    const isBlacklisted = flag(tokenData.is_blacklisted);
    if (isBlacklisted === 'no') {
      score += 10;
      factors.push({
        name: 'blacklist_status',
        status: 'pass',
        detail: 'Address is not on any known blacklists.',
      });
    } else if (isBlacklisted === 'yes') {
      factors.push({
        name: 'blacklist_status',
        status: 'fail',
        detail: 'Address appears on a known blacklist — do not transact.',
      });
    } else {
      // unknown
      score += 5;
      partial = true;
      factors.push({
        name: 'blacklist_status',
        status: 'warning',
        detail: 'Blacklist status could not be determined.',
      });
    }
  } else if (addressData !== null) {
    // Fall back to address security for blacklist
    const isCriminal =
      addressData.cybercrime === '1' ||
      addressData.financial_crime === '1' ||
      addressData.money_laundering === '1';

    if (!isCriminal) {
      score += 10;
      factors.push({
        name: 'blacklist_status',
        status: 'pass',
        detail: 'No blacklist or criminal flags detected via GoPlus address database.',
      });
    } else {
      factors.push({
        name: 'blacklist_status',
        status: 'fail',
        detail: 'Criminal/blacklist flags detected on this address.',
      });
    }
  } else {
    partial = true;
  }

  // ── Honeypot score cap ────────────────────────────────────────────────────
  if (honeypotDetected) {
    score = Math.min(score, 20);
  }

  // ── Clamp and compute risk level ──────────────────────────────────────────
  score = clamp(Math.round(score), 0, 100);
  const riskLevel = toRiskLevel(score);

  // ── Generate recommendation ───────────────────────────────────────────────
  const recommendation = generateRecommendation(score, riskLevel, factors, honeypotDetected);

  return {
    score,
    riskLevel,
    factors,
    partial,
    recommendation,
    disclaimer: FINANCIAL_DISCLAIMER,
    pricingNote: PRICING_NOTES['wallet-health'],
  };
}

function generateRecommendation(
  score: number,
  riskLevel: RiskLevel,
  factors: Factor[],
  honeypotDetected: boolean,
): string {
  if (honeypotDetected) {
    return 'AVOID: Honeypot contract detected — any funds sent may be permanently trapped. Do not interact with this address.';
  }

  const fails = factors.filter((f) => f.status === 'fail');
  const warnings = factors.filter((f) => f.status === 'warning');

  if (riskLevel === 'low') {
    if (warnings.length === 0) {
      return 'This address passed all security checks with no red flags. Appears safe for standard due diligence purposes.';
    }
    return `This address looks generally safe (score ${score}/100), but has ${warnings.length} minor warning(s) — review before transacting.`;
  }

  if (riskLevel === 'medium') {
    const topWarning = fails[0] ?? warnings[0];
    const hint = topWarning
      ? ` Key concern: ${topWarning.detail ?? topWarning.name}.`
      : '';
    return `Moderate risk detected (score ${score}/100).${hint} Exercise caution and verify independently.`;
  }

  if (riskLevel === 'high') {
    const topFail = fails[0];
    const hint = topFail ? ` Critical: ${topFail.detail ?? topFail.name}.` : '';
    return `High risk signals present (score ${score}/100).${hint} Proceed only with full knowledge of the risks.`;
  }

  // critical
  const topFail = fails[0];
  const hint = topFail ? ` Reason: ${topFail.detail ?? topFail.name}.` : '';
  return `Critical risk (score ${score}/100).${hint} Strong recommendation: do not transact with this address.`;
}
