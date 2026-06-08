import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE users ADD COLUMN is_disabled INTEGER DEFAULT 0", (err) => {
    if (err) {
      console.log("is_disabled column might already exist:", err.message);
    } else {
      console.log("is_disabled column added successfully to users table!");
    }
  });
});
