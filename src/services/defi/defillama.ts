import axios, { AxiosError } from 'axios';
import { cachedFetch } from '../../lib/cache.js';
import { UpstreamError } from '../../lib/schema.js';

const POOLS_URL = 'https://yields.llama.fi/pools';
const TIMEOUT_MS = 5_000;

export interface DefiLlamaPool {
  chain: string;                // e.g. "Ethereum", "BSC"
  project: string;              // e.g. "aave-v3"
  symbol: string;               // e.g. "USDT", "USDC-USDT"
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number | null;           // combined APY
  pool: string;                 // pool ID / address
  poolMeta: string | null;
  url: string;
  rewardTokens: string[] | null;
  underlyingTokens: string[] | null;
  ilRisk: string | null;
  exposure: string | null;
  stablecoin: boolean;
  mu: number | null;            // mean APY (historical)
  sigma: number | null;         // APY volatility
  outlier: boolean;
}

interface DefiLlamaResponse {
  status: string;
  data: DefiLlamaPool[];
}

/**
 * Fetch all yield pools from DeFiLlama.
 * No API key required. Cached for 60s.
 */
export async function getAllPools(): Promise<DefiLlamaPool[]> {
  return cachedFetch('defillama:pools', async () => {
    try {
      const resp = await axios.get<DefiLlamaResponse>(POOLS_URL, {
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'OKX-Finance-Copilot-ASP/1.0' },
      });

      if (resp.data.status !== 'success' || !Array.isArray(resp.data.data)) {
        throw new UpstreamError(
          `DeFiLlama pools returned unexpected status: ${resp.data.status}`,
          'DeFiLlama API',
        );
      }

      return resp.data.data;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;

      if (err instanceof AxiosError) {
        if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
          throw new UpstreamError(
            `DeFiLlama /pools timed out after ${TIMEOUT_MS}ms`,
            'DeFiLlama API',
          );
        }
        throw new UpstreamError(
          `DeFiLlama /pools returned HTTP ${err.response?.status ?? 'unknown'}: ${err.message}`,
          'DeFiLlama API',
        );
      }

      throw new UpstreamError(`DeFiLlama unexpected error: ${String(err)}`, 'DeFiLlama API');
    }
  });
}
