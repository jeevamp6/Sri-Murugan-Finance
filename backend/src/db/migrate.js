import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
console.log('Migrating database at:', dbPath);

const db = new sqlite3.Database(dbPath);

const runQuery = (sql) => {
  return new Promise((resolve) => {
    db.run(sql, (err) => {
      if (err) {
        // Suppress "duplicate column" errors
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
          console.log(`Column already exists: ${sql.slice(0, 40)}...`);
        } else {
          console.error(`Error running query: ${sql}`, err);
        }
      } else {
        console.log(`Query ran successfully: ${sql.slice(0, 40)}...`);
      }
      resolve();
    });
  });
};

async function migrate() {
  // Add is_active to customers
  await runQuery('ALTER TABLE customers ADD COLUMN is_active INTEGER DEFAULT 1');
  
  // Add balance_after to collections
  await runQuery('ALTER TABLE collections ADD COLUMN balance_after REAL DEFAULT 0');

  console.log('Migration finished successfully!');
  process.exit(0);
}

migrate();
