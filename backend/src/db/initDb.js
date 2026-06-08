import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import fileURLToPath from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
console.log('Initializing database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

db.serialize(async () => {
  // Execute schema queries split by semicolon
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    db.run(statement, (err) => {
      if (err) {
        console.error('Error executing query:', statement, err);
      }
    });
  }

  // Create default admin user
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  db.get('SELECT * FROM users WHERE username = ?', [adminUsername], (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    if (!row) {
      db.run(
        'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
        [adminUsername, hashedPassword, 'admin', 'Administrator'],
        (err) => {
          if (err) {
            console.error('Error seeding admin user:', err);
          } else {
            console.log('Seeded default admin user successfully: admin / admin123');
          }
        }
      );
    } else {
      console.log('Admin user already exists.');
    }
  });

  // Seed default settings
  const defaultSettings = [
    { key: 'business_name', value: 'Sri Murugan Finance' },
    { key: 'business_address', value: 'Main Road, Villupuram, Tamil Nadu' },
    { key: 'business_phone', value: '+91 9876543210' },
    { key: 'interest_rate_default', value: '2' },
    { key: 'language_default', value: 'en' }
  ];

  for (const setting of defaultSettings) {
    db.run(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [setting.key, setting.value],
      (err) => {
        if (err) console.error('Error seeding setting:', err);
      }
    );
  }
});
