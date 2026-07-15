export interface ChainConfig {
  /** Internal chain identifier used in API requests */
  id: string;
  /** Human-readable chain name */
  name: string;
  /** GoPlus Security API chain ID (string) */
  goplusChainId: string;
  /** DeFiLlama chain name (for pool filtering) */
  defillamaName: string;
  /** Etherscan-compatible explorer API base URL */
  explorerApiBase: string;
  /** Environment variable key for the explorer API key */
  explorerApiEnvKey: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    goplusChainId: '1',
    defillamaName: 'Ethereum',
    explorerApiBase: 'https://api.etherscan.io/api',
    explorerApiEnvKey: 'ETHERSCAN_API_KEY',
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    goplusChainId: '56',
    defillamaName: 'BSC',
    explorerApiBase: 'https://api.bscscan.com/api',
    explorerApiEnvKey: 'BSCSCAN_API_KEY',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    goplusChainId: '137',
    defillamaName: 'Polygon',
    explorerApiBase: 'https://api.polygonscan.com/api',
    explorerApiEnvKey: 'POLYGONSCAN_API_KEY',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    goplusChainId: '42161',
    defillamaName: 'Arbitrum',
    explorerApiBase: 'https://api.arbiscan.io/api',
    explorerApiEnvKey: 'ARBISCAN_API_KEY',
  },
  xlayer: {
    id: 'xlayer',
    name: 'X Layer (OKX)',
    goplusChainId: '196',
    defillamaName: 'X Layer',
    explorerApiBase: 'https://www.oklink.com/api/v5/explorer',
    explorerApiEnvKey: 'OKLINK_API_KEY',
  },
};

export const SUPPORTED_CHAINS = Object.keys(CHAINS);

export function getChain(chain: string): ChainConfig | undefined {
  return CHAINS[chain.toLowerCase()];
}
