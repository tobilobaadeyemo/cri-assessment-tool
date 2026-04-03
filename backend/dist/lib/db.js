"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
const pg_1 = require("pg");
const logger_1 = require("./logger");
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool.on('error', (err) => {
    logger_1.logger.error('Unexpected PostgreSQL error', err);
});
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await exports.pool.query(text, params);
        const duration = Date.now() - start;
        logger_1.logger.debug('Query executed', { text: text.substring(0, 80), duration, rows: res.rowCount });
        return res;
    }
    catch (err) {
        logger_1.logger.error('Query error', { text: text.substring(0, 80), err });
        throw err;
    }
}
//# sourceMappingURL=db.js.map