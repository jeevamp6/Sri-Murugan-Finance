import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("PRAGMA foreign_keys=OFF;");
  
  db.run("ALTER TABLE users RENAME TO users_old;", (err) => {
    if (err) {
      console.error("Error renaming table:", err.message);
    }
  });
  
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'family', 'staff', 'customer')),
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `, (err) => {
    if (err) {
      console.error("Error creating new users table:", err.message);
    }
  });
  
  db.run(`
    INSERT INTO users (id, username, password_hash, role, name, created_at)
    SELECT id, username, password_hash, role, name, created_at FROM users_old;
  `, (err) => {
    if (err) {
      console.error("Error copying data:", err.message);
    }
  });
  
  db.run("DROP TABLE users_old;", (err) => {
    if (err) {
      console.error("Error dropping old table:", err.message);
    } else {
      console.log("Users table check constraint updated successfully in SQLite database!");
    }
  });
  
  db.run("PRAGMA foreign_keys=ON;");
});
