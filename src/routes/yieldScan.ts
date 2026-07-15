import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { YieldScanRequestSchema, AppError, FINANCIAL_DISCLAIMER, PRICING_NOTES } from '../lib/schema.js';
import { getAllPools } from '../services/defi/defillama.js';
import { rankPools } from '../services/defi/rank.js';

export const yieldScanRouter = Router();

yieldScanRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ── Validate input ──────────────────────────────────────────────────────
    let parsed: ReturnType<typeof YieldScanRequestSchema.parse>;
    try {
      parsed = YieldScanRequestSchema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError(400, 'VALIDATION_ERROR', message));
      }
      throw err;
    }

    const { asset, chains, minTvlUsd, riskTolerance } = parsed;

    // ── Fetch pools ─────────────────────────────────────────────────────────
    const allPools = await getAllPools();

    // ── Rank ────────────────────────────────────────────────────────────────
    const opportunities = rankPools(allPools, {
      asset,
      chains,
      minTvlUsd,
      riskTolerance,
    });

    if (opportunities.length === 0) {
      return res.status(200).json({
        asset,
        opportunities: [],
        topPick: null,
        message: `No yield opportunities found for ${asset} matching your criteria. Try lowering minTvlUsd or expanding chains.`,
        disclaimer: FINANCIAL_DISCLAIMER,
        pricingNote: PRICING_NOTES['yield-scan'],
        generatedAt: new Date().toISOString(),
      });
    }

    const topPick = opportunities[0];

    // ── Respond ─────────────────────────────────────────────────────────────
    return res.status(200).json({
      asset,
      filters: { chains, minTvlUsd, riskTolerance },
      opportunities,
      topPick,
      dataSource: ['DeFiLlama Yields API'],
      disclaimer: FINANCIAL_DISCLAIMER,
      pricingNote: PRICING_NOTES['yield-scan'],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Method-not-allowed for non-POST
yieldScanRouter.all('/', (_req: Request, res: Response) => {
  res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported on this endpoint.' },
  });
});
