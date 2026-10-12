// Load .env here so every file that imports the pool sees DB_* values,
// no matter which file is the entry point (server.js, seed.js, migrate_v2.js...).
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { Pool, types } = require('pg');

// COUNT(*) and other bigint values come back as strings by default — return numbers.
types.setTypeParser(20, (v) => parseInt(v, 10));

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // required for Render PostgreSQL
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        user:     process.env.DB_USER     || 'postgres',
        password: String(process.env.DB_PASSWORD ?? ''),
        database: process.env.DB_NAME     || 'ssmls_db',
      }
);

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL connection error:', err.message);
    return false;
  }
}

// Helper: converts mysql2-style (?, ?) placeholders to pg-style ($1, $2)
function toPostgres(sql, params = []) {
  let i = 0;
  const converted = sql.replace(/\?/g, () => `$${++i}`);
  return { sql: converted, params };
}

// ── MySQL → PostgreSQL compatibility layer ───────────────────────────────────
// Many route files were written for MySQL (pool.execute, "?" placeholders,
// insertId, FIELD(), CURDATE() ...). This layer lets them run on PostgreSQL.
function translateSql(sql) {
  let s = toPostgres(sql).sql;
  s = s.replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE');
  const BOOL_COLS = 'is_active|email_verified|is_read|is_locked|is_published|allow_retake|attendance_open';
  s = s.replace(new RegExp('\\b(' + BOOL_COLS + ')\\s*=\\s*1\\b', 'gi'), '$1 = TRUE');
  s = s.replace(new RegExp('\\b(' + BOOL_COLS + ')\\s*=\\s*0\\b', 'gi'), '$1 = FALSE');
  s = s.replace(/\bMONTH\(([^()]+)\)/gi, 'EXTRACT(MONTH FROM $1)');
  s = s.replace(/\bYEAR\(([^()]+)\)/gi, 'EXTRACT(YEAR FROM $1)');
  s = s.replace(/\bFIELD\(\s*([\w.]+)\s*,([^)]*)\)/gi,
    (_, col, list) => `array_position(ARRAY[${list}]::text[], ${col}::text)`);
  s = s.replace(/\bLIKE\b/g, 'ILIKE'); // MySQL LIKE is case-insensitive
  return s;
}

async function run(runner, sql, params = []) {
  let text = translateSql(sql).trim().replace(/;$/, '');
  const isInsert = /^INSERT\b/i.test(text);
  if (isInsert && !/\bRETURNING\b/i.test(text)) text += ' RETURNING id';
  try {
    const result = await runner.query(text, params);
    if (/^SELECT|^WITH/i.test(text)) return [result.rows, result.fields];
    return [{
      insertId:     isInsert ? result.rows?.[0]?.id : undefined,
      affectedRows: result.rowCount,
      rows:         result.rows,
    }];
  } catch (err) {
    if (err.code === '23505') err.code = 'ER_DUP_ENTRY'; // unique violation
    throw err;
  }
}

pool.execute = (sql, params) => run(pool, sql, params);

pool.getConnection = async () => {
  const client = await pool.connect();
  return {
    execute:          (sql, params) => run(client, sql, params),
    query:            (sql, params) => run(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit:           () => client.query('COMMIT'),
    rollback:         () => client.query('ROLLBACK'),
    release:          () => client.release(),
  };
};

module.exports = { pool, testConnection, toPostgres };
