import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { WalletHealthRequestSchema, AppError } from '../lib/schema.js';
import { getChain } from '../lib/chains.js';
import { getTokenSecurity, getAddressSecurity } from '../services/security/goplus.js';
import { buildHealthScore } from '../services/security/scoring.js';

export const walletHealthRouter = Router();

walletHealthRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ── Validate input ──────────────────────────────────────────────────────
    let parsed: { address: string; chain: string };
    try {
      parsed = WalletHealthRequestSchema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        return next(new AppError(400, 'VALIDATION_ERROR', message));
      }
      throw err;
    }

    const { address, chain } = parsed;
    const chainConfig = getChain(chain);

    // This should never happen since zod validates chain, but be defensive
    if (!chainConfig) {
      return next(new AppError(400, 'UNSUPPORTED_CHAIN', `Chain "${chain}" is not supported.`));
    }

    // ── Fetch upstream data (both in parallel, degrade if either fails) ─────
    const [tokenResult, addressResult] = await Promise.allSettled([
      getTokenSecurity(address, chainConfig.goplusChainId),
      getAddressSecurity(address),
    ]);

    const tokenData = tokenResult.status === 'fulfilled' ? tokenResult.value : null;
    const addressData = addressResult.status === 'fulfilled' ? addressResult.value : null;

    // If BOTH fail, return 502 with details
    if (tokenResult.status === 'rejected' && addressResult.status === 'rejected') {
      const tokenErr = tokenResult.reason as Error;
      const addrErr = addressResult.reason as Error;
      return next(
        new AppError(
          502,
          'UPSTREAM_ERROR',
          `All upstream signals failed. Token security: ${tokenErr.message}. Address security: ${addrErr.message}`,
        ),
      );
    }

    // ── Score ───────────────────────────────────────────────────────────────
    const scoreResult = buildHealthScore(tokenData, addressData);

    // ── Respond ─────────────────────────────────────────────────────────────
    return res.status(200).json({
      address,
      chain,
      score: scoreResult.score,
      riskLevel: scoreResult.riskLevel,
      factors: scoreResult.factors,
      recommendation: scoreResult.recommendation,
      partial: scoreResult.partial,
      dataSource: ['GoPlus Security API'],
      disclaimer: scoreResult.disclaimer,
      pricingNote: scoreResult.pricingNote,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Method-not-allowed for non-POST
walletHealthRouter.all('/', (_req: Request, res: Response) => {
  res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported on this endpoint.' },
  });
});
