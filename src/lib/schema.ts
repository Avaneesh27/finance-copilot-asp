import { z } from 'zod';
import { SUPPORTED_CHAINS } from './chains.js';

// ─── Shared error envelope ────────────────────────────────────────────────────

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

// ─── Wallet Health ────────────────────────────────────────────────────────────

export const WalletHealthRequestSchema = z.object({
  address: z
    .string()
    .min(1, 'address is required')
    .regex(/^0x[0-9a-fA-F]{40}$/, 'address must be a valid EVM address (0x + 40 hex chars)'),
  chain: z
    .string()
    .toLowerCase()
    .refine((c) => SUPPORTED_CHAINS.includes(c), {
      message: `chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`,
    }),
});

export type WalletHealthRequest = z.infer<typeof WalletHealthRequestSchema>;

export const FactorStatusSchema = z.enum(['pass', 'warning', 'fail']);

export const FactorSchema = z.object({
  name: z.string(),
  status: FactorStatusSchema,
  detail: z.string().optional(),
  topHolderPct: z.number().optional(),
  usd: z.number().optional(),
  count: z.number().optional(),
});

export type Factor = z.infer<typeof FactorSchema>;
export type FactorStatus = z.infer<typeof FactorStatusSchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// ─── Yield Scan ──────────────────────────────────────────────────────────────

export const RiskToleranceSchema = z.enum(['conservative', 'balanced', 'aggressive']);
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

export const YieldScanRequestSchema = z.object({
  asset: z
    .string()
    .min(1, 'asset is required (e.g. USDT, USDC, DAI)')
    .toUpperCase(),
  chains: z
    .array(z.string().toLowerCase())
    .optional()
    .default(SUPPORTED_CHAINS),
  minTvlUsd: z
    .number()
    .positive()
    .optional()
    .default(1_000_000),
  riskTolerance: RiskToleranceSchema.optional().default('balanced'),
});

export type YieldScanRequest = z.infer<typeof YieldScanRequestSchema>;

// ─── Tax Report ───────────────────────────────────────────────────────────────

export const CostBasisMethodSchema = z.enum(['FIFO', 'LIFO']);
export type CostBasisMethod = z.infer<typeof CostBasisMethodSchema>;

export const TaxReportRequestSchema = z.object({
  address: z
    .string()
    .min(1, 'address is required')
    .regex(/^0x[0-9a-fA-F]{40}$/, 'address must be a valid EVM address'),
  chain: z
    .string()
    .toLowerCase()
    .refine((c) => SUPPORTED_CHAINS.includes(c), {
      message: `chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`,
    }),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate must be YYYY-MM-DD'),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate must be YYYY-MM-DD'),
  costBasisMethod: CostBasisMethodSchema.optional().default('FIFO'),
});

export type TaxReportRequest = z.infer<typeof TaxReportRequestSchema>;

// ─── Custom error class ───────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UpstreamError extends AppError {
  constructor(message: string, public readonly upstreamName: string) {
    super(502, 'UPSTREAM_ERROR', message);
    this.name = 'UpstreamError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

// ─── DISCLAIMER ───────────────────────────────────────────────────────────────

export const FINANCIAL_DISCLAIMER =
  'Informational only. Not tax, legal, or financial advice — consult a qualified professional before making any financial decisions.';

export const PRICING_NOTES: Record<string, string> = {
  'wallet-health': 'Planned: $0.02/call via x402 micropayment — free during hackathon MVP.',
  'yield-scan': 'Planned: $0.01/call via x402 micropayment — free during hackathon MVP.',
  'tax-report': 'Planned: $0.05/report via x402 micropayment — free during hackathon MVP.',
};
