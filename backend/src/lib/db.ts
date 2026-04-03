import { Pool } from 'pg';
import { logger } from './logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL error', err);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { text: text.substring(0, 80), duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('Query error', { text: text.substring(0, 80), err });
    throw err;
  }
}
