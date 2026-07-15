import { NormalizedTx } from './txFetch.js';

export interface TaxLineItem {
  txHash: string;
  timestamp: string;
  asset: string;
  amount: number;
  type: 'buy' | 'sell' | 'receive' | 'send';
  priceUsd: number;
  totalUsd: number;
  feeUsd: number;
  realizedGainLossUsd: number;
}

export interface TaxSummary {
  totalTransactions: number;
  realizedGainUsd: number;
  realizedLossUsd: number;
  netUsd: number;
}

export interface CostBasisResult {
  summary: TaxSummary;
  transactions: TaxLineItem[];
}

interface InventoryLot {
  amount: number;
  priceUsd: number;
  timestamp: number;
}

/**
 * Calculates FIFO cost basis for a list of normalized transactions.
 * Returns a summary of gains/losses and detailed line items.
 */
export function calculateFIFOCostBasis(
  txs: NormalizedTx[],
  resolvedPrices: Record<string, number>, // Map of `${txHash}:${asset}` -> USD price
): CostBasisResult {
  const inventory: Record<string, InventoryLot[]> = {};
  const transactions: TaxLineItem[] = [];
  
  let totalRealizedGain = 0;
  let totalRealizedLoss = 0;

  for (const tx of txs) {
    const priceUsd = resolvedPrices[`${tx.txHash}:${tx.asset}`] ?? 1.0;
    const totalUsd = tx.amount * priceUsd;
    let realizedGainLossUsd = 0;

    if (!inventory[tx.asset]) {
      inventory[tx.asset] = [];
    }

    if (tx.type === 'in') {
      // Inflow: Add to inventory lot
      inventory[tx.asset].push({
        amount: tx.amount,
        priceUsd,
        timestamp: tx.timestamp,
      });

      transactions.push({
        txHash: tx.txHash,
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        asset: tx.asset,
        amount: tx.amount,
        type: 'receive',
        priceUsd,
        totalUsd,
        feeUsd: tx.feeUsd,
        realizedGainLossUsd: 0,
      });
    } else {
      // Outflow: Consume from inventory lots using FIFO
      let remainingToConsume = tx.amount;
      let costBasisUsd = 0;

      const lots = inventory[tx.asset];

      while (remainingToConsume > 0 && lots.length > 0) {
        const oldestLot = lots[0];
        const consumeAmount = Math.min(remainingToConsume, oldestLot.amount);

        costBasisUsd += consumeAmount * oldestLot.priceUsd;
        oldestLot.amount -= consumeAmount;
        remainingToConsume -= consumeAmount;

        if (oldestLot.amount <= 0) {
          lots.shift();
        }
      }

      // If we sold more than we tracked inflows for (e.g. initial balance before fromDate),
      // we assume the cost basis for the untracked part is $0 (conservative tax approach).
      if (remainingToConsume > 0) {
        // Untracked cost basis = $0
        costBasisUsd += 0;
      }

      // Realized Gain/Loss = Sale Proceeds - Cost Basis
      realizedGainLossUsd = totalUsd - costBasisUsd;

      if (realizedGainLossUsd > 0) {
        totalRealizedGain += realizedGainLossUsd;
      } else {
        totalRealizedLoss += realizedGainLossUsd; // negative value
      }

      transactions.push({
        txHash: tx.txHash,
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        asset: tx.asset,
        amount: tx.amount,
        type: 'send',
        priceUsd,
        totalUsd,
        feeUsd: tx.feeUsd,
        realizedGainLossUsd: parseFloat(realizedGainLossUsd.toFixed(2)),
      });
    }
  }

  const netUsd = totalRealizedGain + totalRealizedLoss;

  return {
    summary: {
      totalTransactions: txs.length,
      realizedGainUsd: parseFloat(totalRealizedGain.toFixed(2)),
      realizedLossUsd: parseFloat(totalRealizedLoss.toFixed(2)),
      netUsd: parseFloat(netUsd.toFixed(2)),
    },
    transactions,
  };
}
