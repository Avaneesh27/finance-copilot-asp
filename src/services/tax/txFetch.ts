import axios from 'axios';
import { ChainConfig } from '../../lib/chains.js';
import { UpstreamError } from '../../lib/schema.js';
import { cachedFetch } from '../../lib/cache.js';

const TIMEOUT_MS = 5_000;

export interface RawTx {
  hash: string;
  blockNumber: string;
  timeStamp: string; // Unix timestamp string
  from: string;
  to: string;
  value: string; // in wei
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string; // "0" = success
}

export interface RawTokenTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  value: string;
}

export interface NormalizedTx {
  txHash: string;
  timestamp: number; // in seconds
  from: string;
  to: string;
  asset: string; // e.g. "ETH" or token symbol
  contractAddress?: string;
  amount: number;
  type: 'in' | 'out';
  feeUsd: number;
}

/**
 * Fetch normal transactions (ETH) from block explorer
 */
async function fetchNormalTxs(
  address: string,
  config: ChainConfig,
  apiKey: string,
): Promise<RawTx[]> {
  try {
    const resp = await axios.get<{ status: string; message: string; result: RawTx[] | string }>(
      config.explorerApiBase,
      {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          startblock: 0,
          endblock: 99999999,
          sort: 'asc',
          apikey: apiKey,
        },
        timeout: TIMEOUT_MS,
      },
    );

    if (resp.data.status !== '1' || typeof resp.data.result === 'string') {
      // "No transactions found" returns status '0', treat as empty
      if (resp.data.message === 'No transactions found') return [];
      throw new Error(`Explorer API error: ${resp.data.result || resp.data.message}`);
    }

    return resp.data.result;
  } catch (err) {
    throw new UpstreamError(
      `Failed to fetch normal transactions: ${(err as Error).message}`,
      `${config.name} Explorer API`,
    );
  }
}

/**
 * Fetch ERC-20 token transfers from block explorer
 */
async function fetchTokenTxs(
  address: string,
  config: ChainConfig,
  apiKey: string,
): Promise<RawTokenTx[]> {
  try {
    const resp = await axios.get<{ status: string; message: string; result: RawTokenTx[] | string }>(
      config.explorerApiBase,
      {
        params: {
          module: 'account',
          action: 'tokentx',
          address,
          startblock: 0,
          endblock: 99999999,
          sort: 'asc',
          apikey: apiKey,
        },
        timeout: TIMEOUT_MS,
      },
    );

    if (resp.data.status !== '1' || typeof resp.data.result === 'string') {
      if (resp.data.message === 'No transactions found') return [];
      throw new Error(`Explorer API error: ${resp.data.result || resp.data.message}`);
    }

    return resp.data.result;
  } catch (err) {
    throw new UpstreamError(
      `Failed to fetch ERC-20 transfers: ${(err as Error).message}`,
      `${config.name} Explorer API`,
    );
  }
}

/**
 * Resolves historical token prices using the DeFiLlama Coins API.
 * Uses a batch approach or single requests.
 * Address 0x0000000000000000000000000000000000000000 or empty contractAddress resolves to native token.
 */
export async function getHistoricalPrice(
  chain: string,
  contractAddress: string | undefined,
  timestamp: number,
): Promise<number> {
  const coinKey = contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000'
    ? `${chain}:${contractAddress.toLowerCase()}`
    : `coingecko:${chain === 'bsc' ? 'binancecoin' : chain}`;

  const cacheKey = `price:${coinKey}:${timestamp}`;

  return cachedFetch(cacheKey, async () => {
    try {
      const resp = await axios.get<{
        coins: Record<string, { price: number }>;
      }>(`https://coins.llama.fi/prices/historical/${timestamp}/${coinKey}`, {
        timeout: TIMEOUT_MS,
      });

      const coinData = resp.data?.coins?.[coinKey];
      return coinData?.price ?? 1.0; // Fallback to $1.0 if not found (sensible for stablecoins)
    } catch {
      // Graceful fallback for demo stability
      return 1.0;
    }
  });
}

/**
 * Fetch and normalize transactions for tax cost-basis processing.
 * Merges native and token transfers sorted by time.
 */
export async function fetchAndNormalizeTxs(
  address: string,
  config: ChainConfig,
  apiKey: string,
): Promise<NormalizedTx[]> {
  const [rawTxs, rawTokenTxs] = await Promise.all([
    fetchNormalTxs(address, config, apiKey),
    fetchTokenTxs(address, config, apiKey),
  ]);

  const normalized: NormalizedTx[] = [];

  // Normalize native transfers
  for (const tx of rawTxs) {
    if (tx.isError === '1') continue; // skip failed transactions
    const valueEth = parseFloat(tx.value) / 1e18;
    if (valueEth === 0) continue; // skip contract calls without transfer values

    const isOut = tx.from.toLowerCase() === address.toLowerCase();
    const gasUsed = parseFloat(tx.gasUsed);
    const gasPrice = parseFloat(tx.gasPrice);
    const feeEth = (gasUsed * gasPrice) / 1e18;

    normalized.push({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp, 10),
      from: tx.from,
      to: tx.to,
      asset: config.id === 'bsc' ? 'BNB' : 'ETH',
      amount: valueEth,
      type: isOut ? 'out' : 'in',
      feeUsd: feeEth * 3000, // Approximate fee calculation or resolve later
    });
  }

  // Normalize ERC-20 transfers
  for (const tx of rawTokenTxs) {
    const decimals = parseInt(tx.tokenDecimal, 10) || 18;
    const valueToken = parseFloat(tx.value) / Math.pow(10, decimals);
    if (valueToken === 0) continue;

    const isOut = tx.from.toLowerCase() === address.toLowerCase();

    normalized.push({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp, 10),
      from: tx.from,
      to: tx.to,
      asset: tx.tokenSymbol || 'TOKEN',
      contractAddress: tx.contractAddress,
      amount: valueToken,
      type: isOut ? 'out' : 'in',
      feeUsd: 0, // Fee is borne by the sender of native tx, we ignore gas fee allocation here
    });
  }

  // Sort chronologically
  return normalized.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Returns deterministic realistic mocks for demo if API key is missing.
 */
export function generateMockTxs(address: string, fromDate: string, toDate: string): NormalizedTx[] {
  const tStart = Math.floor(new Date(fromDate).getTime() / 1000);
  const tEnd = Math.floor(new Date(toDate).getTime() / 1000);
  const tRange = tEnd - tStart;

  // Stable seed from address
  let seed = 0;
  for (let i = 0; i < address.length; i++) {
    seed += address.charCodeAt(i);
  }

  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const numTxs = Math.floor(random() * 15) + 5; // 5-20 transactions
  const assets = ['ETH', 'USDT', 'USDC'];
  const normalized: NormalizedTx[] = [];

  for (let i = 0; i < numTxs; i++) {
    const timestamp = tStart + Math.floor(random() * tRange);
    const asset = assets[Math.floor(random() * assets.length)];
    const amount = asset === 'ETH' ? parseFloat((random() * 2 + 0.05).toFixed(4)) : Math.floor(random() * 500) + 10;
    const type = random() > 0.5 ? 'in' : 'out';

    normalized.push({
      txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(random() * 16).toString(16)).join(''),
      timestamp,
      from: type === 'in' ? '0x' + '1'.repeat(40) : address,
      to: type === 'in' ? address : '0x' + '2'.repeat(40),
      asset,
      amount,
      type,
      feeUsd: asset === 'ETH' ? parseFloat((random() * 0.5 + 0.1).toFixed(2)) : 0,
    });
  }

  return normalized.sort((a, b) => a.timestamp - b.timestamp);
}
