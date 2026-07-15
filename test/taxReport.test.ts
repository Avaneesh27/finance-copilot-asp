import { describe, it, expect } from 'vitest';
import { calculateFIFOCostBasis } from '../src/services/tax/costBasis';
import type { NormalizedTx } from '../src/services/tax/txFetch';

describe('calculateFIFOCostBasis', () => {
  it('calculates realized gains correctly for FIFO buy then sell', () => {
    // 1. Buy 2 ETH at $1000 each
    // 2. Buy 1 ETH at $2000
    // 3. Sell 1.5 ETH at $3000 each (Proceeds = $4500)
    // FIFO cost basis should use the first lot (1.5 ETH * $1000 = $1500)
    // Realized gain = $4500 - $1500 = $3000
    const txs: NormalizedTx[] = [
      {
        txHash: '0x1',
        timestamp: 1700000000,
        from: '0xsender',
        to: '0xreceiver',
        asset: 'ETH',
        amount: 2.0,
        type: 'in',
        feeUsd: 0,
      },
      {
        txHash: '0x2',
        timestamp: 1701000000,
        from: '0xsender2',
        to: '0xreceiver',
        asset: 'ETH',
        amount: 1.0,
        type: 'in',
        feeUsd: 0,
      },
      {
        txHash: '0x3',
        timestamp: 1702000000,
        from: '0xreceiver',
        to: '0xrecipient',
        asset: 'ETH',
        amount: 1.5,
        type: 'out',
        feeUsd: 5.0,
      },
    ];

    const resolvedPrices: Record<string, number> = {
      '0x1:ETH': 1000,
      '0x2:ETH': 2000,
      '0x3:ETH': 3000,
    };

    const result = calculateFIFOCostBasis(txs, resolvedPrices);

    expect(result.summary.totalTransactions).toBe(3);
    expect(result.summary.realizedGainUsd).toBe(3000); // 1.5 * (3000 - 1000)
    expect(result.summary.realizedLossUsd).toBe(0);
    expect(result.summary.netUsd).toBe(3000);

    expect(result.transactions[2].realizedGainLossUsd).toBe(3000);
  });

  it('handles realized losses correctly', () => {
    // 1. Buy 1 ETH at $2000
    // 2. Sell 1 ETH at $1500 (Proceeds = $1500)
    // Cost basis = $2000
    // Realized loss = -$500
    const txs: NormalizedTx[] = [
      {
        txHash: '0x1',
        timestamp: 1700000000,
        from: '0xsender',
        to: '0xreceiver',
        asset: 'ETH',
        amount: 1.0,
        type: 'in',
        feeUsd: 0,
      },
      {
        txHash: '0x2',
        timestamp: 1702000000,
        from: '0xreceiver',
        to: '0xrecipient',
        asset: 'ETH',
        amount: 1.0,
        type: 'out',
        feeUsd: 5.0,
      },
    ];

    const resolvedPrices: Record<string, number> = {
      '0x1:ETH': 2000,
      '0x2:ETH': 1500,
    };

    const result = calculateFIFOCostBasis(txs, resolvedPrices);

    expect(result.summary.realizedGainUsd).toBe(0);
    expect(result.summary.realizedLossUsd).toBe(-500);
    expect(result.summary.netUsd).toBe(-500);
  });

  it('assumes $0 cost basis if selling without tracked inflows', () => {
    // Sell 1 ETH at $1500 without previous buys
    // Proceeds = $1500, Cost basis = $0
    // Realized gain = $1500
    const txs: NormalizedTx[] = [
      {
        txHash: '0x1',
        timestamp: 1702000000,
        from: '0xreceiver',
        to: '0xrecipient',
        asset: 'ETH',
        amount: 1.0,
        type: 'out',
        feeUsd: 5.0,
      },
    ];

    const resolvedPrices: Record<string, number> = {
      '0x1:ETH': 1500,
    };

    const result = calculateFIFOCostBasis(txs, resolvedPrices);

    expect(result.summary.realizedGainUsd).toBe(1500);
    expect(result.summary.realizedLossUsd).toBe(0);
    expect(result.summary.netUsd).toBe(1500);
  });
});
