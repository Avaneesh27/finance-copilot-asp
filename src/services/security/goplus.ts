import axios, { AxiosError } from 'axios';
import { cachedFetch } from '../../lib/cache.js';
import { UpstreamError } from '../../lib/schema.js';

const BASE_URL = 'https://api.gopluslabs.io/api/v1';
const TIMEOUT_MS = 5_000;
const API_KEY = process.env.GOPLUS_API_KEY;

/** Raw token security data returned by GoPlus for a single contract address */
export interface GoPlusTokenData {
  is_open_source?: string;           // "0" | "1"
  is_proxy?: string;                 // "0" | "1"
  is_mintable?: string;              // "0" | "1"
  is_honeypot?: string;              // "0" | "1"
  honeypot_with_same_creator?: string;
  is_blacklisted?: string;           // "0" | "1"
  is_whitelisted?: string;           // "0" | "1"
  is_anti_whale?: string;
  buy_tax?: string;                  // e.g. "0.05"
  sell_tax?: string;
  cannot_buy?: string;
  cannot_sell_all?: string;
  trading_cooldown?: string;
  transfer_pausable?: string;
  slippage_modifiable?: string;
  hidden_owner?: string;
  can_take_back_ownership?: string;
  owner_address?: string;
  creator_address?: string;
  token_name?: string;
  token_symbol?: string;
  holder_count?: string;
  total_supply?: string;
  holders?: Array<{
    address: string;
    balance: string;
    percent: string;          // e.g. "0.1845" = 18.45%
    is_contract: number;
    tag: string;
    is_locked: number;
  }>;
  lp_holder_count?: string;
  lp_total_supply?: string;
  lp_holders?: Array<{
    address: string;
    balance: string;
    percent: string;
    is_contract: number;
    tag: string;
    is_locked: number;
  }>;
  dex?: Array<{
    name: string;
    liquidity: string;         // USD value as string
    pair: string;
  }>;
  note?: string;
  trust_list?: string;
}

/** Raw address security flags from GoPlus */
export interface GoPlusAddressData {
  blackmail_activities?: string;     // "0" | "1"
  cybercrime?: string;
  data_source?: string;
  darkweb_transactions?: string;
  financial_crime?: string;
  gas_abuse?: string;
  honeypot_related_address?: string;
  malicious_contract_creation?: string;
  money_laundering?: string;
  number_of_malicious_contracts_created?: string;
  phishing_activities?: string;
  reinit?: string;
  stealing_attack?: string;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (API_KEY) headers['Authorization'] = API_KEY;
  return headers;
}

function handleAxiosError(err: unknown, endpoint: string): never {
  if (err instanceof AxiosError) {
    if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') {
      throw new UpstreamError(
        `GoPlus ${endpoint} timed out after ${TIMEOUT_MS}ms`,
        'GoPlus Security API',
      );
    }
    const status = err.response?.status ?? 'unknown';
    throw new UpstreamError(
      `GoPlus ${endpoint} returned HTTP ${status}: ${err.message}`,
      'GoPlus Security API',
    );
  }
  throw new UpstreamError(
    `GoPlus ${endpoint} unexpected error: ${String(err)}`,
    'GoPlus Security API',
  );
}

/**
 * Fetch token security data for a contract address on a given chain.
 * Returns null if GoPlus returns no data for this address (e.g. it's an EOA).
 */
export async function getTokenSecurity(
  address: string,
  goplusChainId: string,
): Promise<GoPlusTokenData | null> {
  const cacheKey = `goplus:token:${goplusChainId}:${address.toLowerCase()}`;

  return cachedFetch(cacheKey, async () => {
    try {
      const resp = await axios.get<{
        code: number;
        message: string;
        result: Record<string, GoPlusTokenData>;
      }>(`${BASE_URL}/token_security/${goplusChainId}`, {
        params: { contract_addresses: address },
        headers: buildHeaders(),
        timeout: TIMEOUT_MS,
      });

      if (resp.data.code !== 1) {
        throw new UpstreamError(
          `GoPlus token_security returned code ${resp.data.code}: ${resp.data.message}`,
          'GoPlus Security API',
        );
      }

      const result = resp.data.result[address.toLowerCase()] 
        ?? resp.data.result[address]
        ?? null;

      return result;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      handleAxiosError(err, 'token_security');
    }
  });
}

/**
 * Fetch address security flags for any EVM address.
 * This is chain-agnostic — GoPlus maintains a cross-chain blacklist.
 */
export async function getAddressSecurity(
  address: string,
): Promise<GoPlusAddressData | null> {
  const cacheKey = `goplus:address:${address.toLowerCase()}`;

  return cachedFetch(cacheKey, async () => {
    try {
      const resp = await axios.get<{
        code: number;
        message: string;
        result: GoPlusAddressData;
      }>(`${BASE_URL}/address_security/${address}`, {
        headers: buildHeaders(),
        timeout: TIMEOUT_MS,
      });

      if (resp.data.code !== 1) {
        // Some addresses legitimately return code 2 (not found) — treat as clean
        return null;
      }

      return resp.data.result ?? null;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      handleAxiosError(err, 'address_security');
    }
  });
}
