import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attaches a unique request ID to every request.
 * Priority: x-request-id header (pass-through) → generated UUID v4.
 * The ID is set on req.headers and returned in the response header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}
