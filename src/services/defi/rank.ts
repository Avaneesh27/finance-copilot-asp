import type { DefiLlamaPool } from './defillama.js';
import type { RiskTolerance } from '../../lib/schema.js';
import { CHAINS } from '../../lib/chains.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YieldOpportunity {
  protocol: string;
  chain: string;
  apy: number;
  tvlUsd: number;
  type: string;
  riskNotes: string;
  url: string;
  symbol: string;
}

interface RankOptions {
  asset: string;
  chains: string[];
  minTvlUsd: number;
  riskTolerance: RiskTolerance;
}

// ─── Chain name mapping (our IDs → DeFiLlama chain names) ────────────────────

const DEFILLAMA_CHAIN_MAP: Record<string, string[]> = {
  ethereum: ['Ethereum'],
  bsc: ['BSC', 'BNB Chain'],
  polygon: ['Polygon'],
  arbitrum: ['Arbitrum', 'Arbitrum One'],
  xlayer: ['X Layer', 'XLayer', 'OKXChain'],
};

// Also accept all DeFiLlama chain names if no chain filter specified
function buildDefillamaChainSet(chains: string[]): Set<string> | null {
  // If the caller passes all supported chains (default), return null = no filter
  const allSupported = Object.keys(CHAINS);
  if (chains.length >= allSupported.length && allSupported.every((c) => chains.includes(c))) {
    return null; // no filter
  }

  const names = new Set<string>();
  for (const c of chains) {
    const mapped = DEFILLAMA_CHAIN_MAP[c.toLowerCase()];
    if (mapped) mapped.forEach((n) => names.add(n));
  }
  return names;
}

// ─── Protocol type inference ──────────────────────────────────────────────────

function inferType(pool: DefiLlamaPool): string {
  const project = pool.project.toLowerCase();
  if (project.includes('aave') || project.includes('compound') || project.includes('morpho')) return 'lending';
  if (project.includes('curve') || project.includes('uniswap') || project.includes('balancer')) return 'dex-lp';
  if (project.includes('yearn') || project.includes('beefy') || project.includes('convex')) return 'yield-aggregator';
  if (project.includes('lido') || project.includes('rocketpool') || project.includes('frax')) return 'liquid-staking';
  if (pool.underlyingTokens && pool.underlyingTokens.length > 1) return 'dex-lp';
  return 'lending';
}

// ─── Risk notes generation ────────────────────────────────────────────────────

function buildRiskNotes(pool: DefiLlamaPool, riskTolerance: RiskTolerance): string {
  const notes: string[] = [];

  if (pool.tvlUsd >= 1_000_000_000) {
    notes.push('Blue-chip protocol with $1B+ TVL');
  } else if (pool.tvlUsd >= 100_000_000) {
    notes.push('Established protocol with deep liquidity');
  } else if (pool.tvlUsd >= 10_000_000) {
    notes.push('Mid-tier TVL — adequate liquidity');
  } else {
    notes.push('Lower TVL — higher liquidity and smart contract risk');
  }

  if (pool.ilRisk === 'yes') notes.push('impermanent loss risk');
  if (pool.sigma !== null && pool.sigma > 5) notes.push('volatile APY history');
  if (pool.rewardTokens && pool.rewardTokens.length > 0) notes.push('includes reward token emissions');
  if (pool.outlier) notes.push('APY is an outlier — verify independently');

  if (riskTolerance === 'conservative' && pool.tvlUsd < 50_000_000) {
    notes.push('⚠ Below conservative TVL threshold');
  }

  return notes.join('; ');
}

// ─── Risk-adjusted score ──────────────────────────────────────────────────────
//
// score = apy * tvlWeightFactor
// tvlWeightFactor = log10(tvlUsd / minTvlUsd + 1)  (soft weight, not hard cutoff)
//
// riskTolerance adjustments:
//   conservative: divide by 1.5 if tvlUsd < 50M
//   aggressive:   no downweight (use score as-is)
//   balanced:     divide by 1.2 if tvlUsd < 10M

function riskAdjustedScore(pool: DefiLlamaPool, minTvlUsd: number, riskTolerance: RiskTolerance): number {
  const apy = pool.apy ?? 0;
  if (apy <= 0) return -Infinity;

  const tvlWeightFactor = Math.log10(pool.tvlUsd / minTvlUsd + 1);
  let score = apy * tvlWeightFactor;

  if (riskTolerance === 'conservative' && pool.tvlUsd < 50_000_000) {
    score /= 1.5;
  } else if (riskTolerance === 'balanced' && pool.tvlUsd < 10_000_000) {
    score /= 1.2;
  }

  // Penalise outliers slightly
  if (pool.outlier) score *= 0.7;

  return score;
}

// ─── Prettify protocol name ───────────────────────────────────────────────────

function formatProtocol(project: string): string {
  return project
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Main ranking function ────────────────────────────────────────────────────

/**
 * Filter, rank, and return top yield opportunities for a given asset.
 * Returns up to 10 results sorted by risk-adjusted score descending.
 */
export function rankPools(
  pools: DefiLlamaPool[],
  opts: RankOptions,
): YieldOpportunity[] {
  const { asset, chains, minTvlUsd, riskTolerance } = opts;
  const chainFilter = buildDefillamaChainSet(chains);

  const filtered = pools.filter((p) => {
    // Asset match: symbol must include the asset string (case-insensitive)
    if (!p.symbol.toUpperCase().includes(asset.toUpperCase())) return false;

    // Chain filter
    if (chainFilter !== null && !chainFilter.has(p.chain)) return false;

    // TVL filter
    if (p.tvlUsd < minTvlUsd) return false;

    // Must have a positive APY
    if (!p.apy || p.apy <= 0) return false;

    return true;
  });

  // Sort by risk-adjusted score descending
  const sorted = filtered.sort(
    (a, b) => riskAdjustedScore(b, minTvlUsd, riskTolerance) - riskAdjustedScore(a, minTvlUsd, riskTolerance),
  );

  // Return top 10
  return sorted.slice(0, 10).map((pool) => ({
    protocol: formatProtocol(pool.project),
    chain: pool.chain,
    apy: parseFloat((pool.apy ?? 0).toFixed(4)),
    tvlUsd: Math.round(pool.tvlUsd),
    type: inferType(pool),
    riskNotes: buildRiskNotes(pool, riskTolerance),
    url: pool.url ?? `https://defillama.com/protocol/${pool.project}`,
    symbol: pool.symbol,
  }));
}
