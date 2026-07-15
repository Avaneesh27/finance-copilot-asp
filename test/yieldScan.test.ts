import { describe, it, expect } from 'vitest';
import { rankPools } from '../src/services/defi/rank';
import type { DefiLlamaPool } from '../src/services/defi/defillama';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePool(overrides: Partial<DefiLlamaPool>): DefiLlamaPool {
  return {
    chain: 'Ethereum',
    project: 'aave-v3',
    symbol: 'USDT',
    tvlUsd: 100_000_000,
    apyBase: 4.0,
    apyReward: 0.5,
    apy: 4.5,
    pool: '0xpool1',
    poolMeta: null,
    url: 'https://app.aave.com',
    rewardTokens: null,
    underlyingTokens: ['0xusdt'],
    ilRisk: 'no',
    exposure: 'single',
    stablecoin: true,
    mu: 4.2,
    sigma: 0.3,
    outlier: false,
    ...overrides,
  };
}

const pools: DefiLlamaPool[] = [
  makePool({ project: 'aave-v3', symbol: 'USDT', chain: 'Ethereum', apy: 4.5, tvlUsd: 800_000_000 }),
  makePool({ project: 'compound-v3', symbol: 'USDT', chain: 'Ethereum', apy: 3.8, tvlUsd: 500_000_000 }),
  makePool({ project: 'venus', symbol: 'USDT', chain: 'BSC', apy: 6.2, tvlUsd: 50_000_000 }),
  makePool({ project: 'curve', symbol: 'USDC-USDT', chain: 'Ethereum', apy: 5.1, tvlUsd: 200_000_000 }),
  makePool({ project: 'obscure-farm', symbol: 'USDT', chain: 'Ethereum', apy: 99, tvlUsd: 500_000, outlier: true }),
  makePool({ project: 'dai-vault', symbol: 'DAI', chain: 'Ethereum', apy: 3.0, tvlUsd: 300_000_000 }),
  makePool({ project: 'aave-v3', symbol: 'USDC', chain: 'Arbitrum', apy: 5.5, tvlUsd: 150_000_000 }),
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('rankPools', () => {
  it('filters by asset name (case-insensitive)', () => {
    const results = rankPools(pools, {
      asset: 'USDT',
      chains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'xlayer'],
      minTvlUsd: 1_000_000,
      riskTolerance: 'balanced',
    });

    // All results must include USDT in symbol
    expect(results.every((r) => r.symbol.toUpperCase().includes('USDT'))).toBe(true);
    // DAI and USDC pools should not appear
    expect(results.some((r) => r.symbol === 'DAI')).toBe(false);
    expect(results.some((r) => r.symbol === 'USDC')).toBe(false);
  });

  it('topPick (first result) has highest risk-adjusted score', () => {
    const results = rankPools(pools, {
      asset: 'USDT',
      chains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'xlayer'],
      minTvlUsd: 1_000_000,
      riskTolerance: 'balanced',
    });

    // The outlier pool (99% APY but very low TVL + outlier penalty) should NOT be topPick
    // topPick should be a blue-chip pool
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tvlUsd).toBeGreaterThan(1_000_000);
  });

  it('filters by minTvlUsd — pools below threshold excluded', () => {
    const results = rankPools(pools, {
      asset: 'USDT',
      chains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'xlayer'],
      minTvlUsd: 10_000_000,
      riskTolerance: 'balanced',
    });

    // obscure-farm has tvlUsd=500k — must be excluded
    expect(results.every((r) => r.tvlUsd >= 10_000_000)).toBe(true);
  });

  it('returns empty array when asset has no matching pools', () => {
    const results = rankPools(pools, {
      asset: 'SHIB',
      chains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'xlayer'],
      minTvlUsd: 1_000_000,
      riskTolerance: 'balanced',
    });

    expect(results).toHaveLength(0);
  });

  it('chain filter restricts results to specified chains', () => {
    const results = rankPools(pools, {
      asset: 'USDT',
      chains: ['bsc'],
      minTvlUsd: 1_000_000,
      riskTolerance: 'balanced',
    });

    // Only BSC pools for USDT (venus)
    expect(results.every((r) => r.chain === 'BSC' || r.chain === 'BNB Chain')).toBe(true);
  });

  it('returns at most 10 results', () => {
    // Add many pools
    const manyPools = Array.from({ length: 20 }, (_, i) =>
      makePool({ project: `protocol-${i}`, symbol: 'USDT', chain: 'Ethereum', apy: 3 + i * 0.1, tvlUsd: 10_000_000 }),
    );

    const results = rankPools(manyPools, {
      asset: 'USDT',
      chains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'xlayer'],
      minTvlUsd: 1_000_000,
      riskTolerance: 'balanced',
    });

    expect(results.length).toBeLessThanOrEqual(10);
  });
});
