import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import path from 'path';
import { requestId } from './middleware/requestId.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { walletHealthRouter } from './routes/walletHealth.js';
import { yieldScanRouter } from './routes/yieldScan.js';
import { taxReportRouter } from './routes/taxReport.js';
import { SUPPORTED_CHAINS } from './lib/chains.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

export const logger = pino({
  level: LOG_LEVEL,
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty' },
  }),
});

const app = express();

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '128kb' }));
app.use(requestId);
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : 'info'),
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, id: req.headers['x-request-id'] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

// Serve landing page at root
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-request-id, Authorization');
  next();
});

app.options('*', (_req, res) => res.sendStatus(204));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/v1', rateLimiter);

// ─── Health check (no rate limit) ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ─── ASP Manifest (for OKX registration) ─────────────────────────────────────
app.get('/manifest', (_req, res) => {
  const base = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;
  res.json({
    name: 'OKX Finance Copilot',
    version: '1.0.0',
    description:
      'Financial due-diligence ASP: wallet & token security scoring, stablecoin yield scanning, and on-chain tax activity reporting.',
    category: 'finance',
    author: 'OKX Finance Copilot',
    supportedChains: SUPPORTED_CHAINS,
    pricingModel: 'free-tier-mvp',
    pricingNote: 'Planned x402 micropayment pricing per endpoint — free during hackathon MVP.',
    disclaimer:
      'Informational only. Not financial, tax, or legal advice. Consult a qualified professional.',
    endpoints: [
      {
        name: 'wallet-health',
        path: '/v1/wallet-health',
        method: 'POST',
        description: 'Returns a 0-100 security health score for a wallet or token contract address.',
        pricingNote: '$0.02/call (planned x402)',
        url: `${base}/v1/wallet-health`,
      },
      {
        name: 'yield-scan',
        path: '/v1/yield-scan',
        method: 'POST',
        description: 'Scans DeFi protocols for the best risk-adjusted stablecoin yield opportunities.',
        pricingNote: '$0.01/call (planned x402)',
        url: `${base}/v1/yield-scan`,
      },
      {
        name: 'tax-report',
        path: '/v1/tax-report',
        method: 'POST',
        description: 'Generates an on-chain tax/activity report with FIFO cost basis (in development).',
        pricingNote: '$0.05/report (planned x402)',
        url: `${base}/v1/tax-report`,
      },
    ],
  });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/v1/wallet-health', walletHealthRouter);
app.use('/v1/yield-scan', yieldScanRouter);
app.use('/v1/tax-report', taxReportRouter);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found. See GET /manifest for available endpoints.',
    },
  });
});

// ─── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV ?? 'development' }, 'OKX Finance Copilot ASP started');
});

export default app;
