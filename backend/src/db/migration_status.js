import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE collections ADD COLUMN status TEXT DEFAULT 'received'", (err) => {
    if (err) {
      console.log('status column might already exist:', err.message);
    } else {
      console.log('status column added successfully');
    }
  });

  db.run("ALTER TABLE collections ADD COLUMN utr TEXT", (err) => {
    if (err) {
      console.log('utr column might already exist:', err.message);
    } else {
      console.log('utr column added successfully');
    }
  });
});
