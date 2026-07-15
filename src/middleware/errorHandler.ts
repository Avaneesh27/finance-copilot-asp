import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/schema.js';
import { logger } from '../server.js';

/**
 * Central error handler — must be the last middleware registered.
 * Maps known error types to appropriate HTTP status codes and always returns
 * the shared error envelope: { error: { code, message } }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  // Zod validation errors → 400
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    logger.warn({ requestId, err: message }, 'Validation error');
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message },
    });
    return;
  }

  // Known app errors (AppError subclasses)
  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.code, statusCode: err.statusCode }, err.message);
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Unknown / unexpected errors → 500
  logger.error({ requestId, err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
  });
}
