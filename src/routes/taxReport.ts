import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { TaxReportRequestSchema, AppError, FINANCIAL_DISCLAIMER, PRICING_NOTES } from '../lib/schema.js';
import { getChain } from '../lib/chains.js';
import { fetchAndNormalizeTxs, generateMockTxs, getHistoricalPrice, NormalizedTx } from '../services/tax/txFetch.js';
import { calculateFIFOCostBasis } from '../services/tax/costBasis.js';
import { logger } from '../server.js';

export const taxReportRouter = Router();

taxReportRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ── Validate input ──────────────────────────────────────────────────────
    let parsed: ReturnType<typeof TaxReportRequestSchema.parse>;
    try {
      parsed = TaxReportRequestSchema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError(400, 'VALIDATION_ERROR', message));
      }
      throw err;
    }

    const { address, chain, fromDate, toDate } = parsed;
    const chainConfig = getChain(chain);

    if (!chainConfig) {
      return next(new AppError(400, 'UNSUPPORTED_CHAIN', `Chain "${chain}" is not supported.`));
    }

    const apiKey = process.env[chainConfig.explorerApiEnvKey];
    let txs: NormalizedTx[] = [];
    let isMock = false;

    // ── Fetch Transactions (Real or Mock Fallback) ──────────────────────────
    if (apiKey) {
      try {
        txs = await fetchAndNormalizeTxs(address, chainConfig, apiKey);
      } catch (err) {
        logger.warn({ err }, 'Failed to fetch real transactions, falling back to mock');
        txs = generateMockTxs(address, fromDate, toDate);
        isMock = true;
      }
    } else {
      logger.info('No explorer API key found, generating mock transactions for demo');
      txs = generateMockTxs(address, fromDate, toDate);
      isMock = true;
    }

    // Filter txs by request period date range
    const tStart = Math.floor(new Date(fromDate).getTime() / 1000);
    const tEnd = Math.floor(new Date(toDate).getTime() / 1000);
    const filteredTxs = txs.filter((t) => t.timestamp >= tStart && t.timestamp <= tEnd);

    // ── Resolve Historical USD Prices ──────────────────────────────────────
    const resolvedPrices: Record<string, number> = {};
    if (filteredTxs.length > 0) {
      await Promise.all(
        filteredTxs.map(async (t) => {
          const price = await getHistoricalPrice(chain, t.contractAddress, t.timestamp);
          resolvedPrices[`${t.txHash}:${t.asset}`] = price;
        }),
      );
    }

    // ── Compute FIFO Cost Basis ─────────────────────────────────────────────
    const result = calculateFIFOCostBasis(filteredTxs, resolvedPrices);

    // ── Respond ─────────────────────────────────────────────────────────────
    return res.status(200).json({
      address,
      period: { from: fromDate, to: toDate },
      summary: result.summary,
      transactions: result.transactions,
      dataSource: isMock ? ['Deterministic Simulated Data'] : [`${chainConfig.name} Explorer`, 'DeFiLlama Coins API'],
      disclaimer: FINANCIAL_DISCLAIMER,
      pricingNote: PRICING_NOTES['tax-report'],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Method-not-allowed for non-POST
taxReportRouter.all('/', (_req: Request, res: Response) => {
  res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported on this endpoint.' },
  });
});

