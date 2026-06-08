import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

let pool = null;
let sqliteDb = null;

if (connectionString) {
  const { Pool } = pg;
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase') 
      ? { rejectUnauthorized: false } 
      : false
  });
} else {
  const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
  sqliteDb = new sqlite3.Database(dbPath);
}

// Helper to translate SQLite '?' placeholders to PostgreSQL '$1', '$2' etc.
const translateSql = (sql) => {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

export const query = {
  get: async (sql, params = []) => {
    if (pool) {
      const pgSql = translateSql(sql);
      const result = await pool.query(pgSql, params);
      return result.rows[0];
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  },
  all: async (sql, params = []) => {
    if (pool) {
      const pgSql = translateSql(sql);
      const result = await pool.query(pgSql, params);
      return result.rows;
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  },
  run: async (sql, params = []) => {
    if (pool) {
      const pgSql = translateSql(sql);
      const result = await pool.query(pgSql, params);
      return { 
        id: result.rows[0]?.id || null, 
        changes: result.rowCount 
      };
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      });
    }
  }
};

export default pool;
