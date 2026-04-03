import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
