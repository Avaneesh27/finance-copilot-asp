import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { TaxReportRequestSchema, AppError, FINANCIAL_DISCLAIMER, PRICING_NOTES } from '../lib/schema.js';

export const taxReportRouter = Router();

/**
 * POST /v1/tax-report
 *
 * P2 stretch goal — currently returns HTTP 501 with a clear coming_soon body.
 * The endpoint contract (request schema, response shape, error format) is fully
 * specified so OKX agents can discover and plan against it.
 *
 * Implementation plan:
 *   - src/services/tax/txFetch.ts  → Etherscan tx history (native + ERC-20)
 *   - src/services/tax/costBasis.ts → FIFO/LIFO realized gain/loss engine
 *   Target: post-hackathon release
 */
taxReportRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate the request shape even in stub mode so agents get proper 400s
    try {
      TaxReportRequestSchema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError(400, 'VALIDATION_ERROR', message));
      }
      throw err;
    }

    return res.status(501).json({
      status: 'coming_soon',
      message:
        'Tax report endpoint is under active development and will launch post-hackathon. ' +
        'The endpoint contract (request/response schema) is finalized — agent integrations can be built now.',
      plannedFeatures: [
        'Native ETH/BNB/MATIC transfer history via block explorers',
        'ERC-20 token transfer history',
        'FIFO and LIFO cost basis calculation',
        'Realized gain/loss per asset per period',
        'CSV and JSON export',
      ],
      pricingNote: PRICING_NOTES['tax-report'],
      disclaimer: FINANCIAL_DISCLAIMER,
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
