import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

console.log('Connecting to PostgreSQL database for migration...');
const { Pool } = pg;
const pool = new Pool({ connectionString });

const schemaSql = fs.readFileSync(path.join(__dirname, 'productionSchema.sql'), 'utf8');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Executing PostgreSQL schema queries...');
    await client.query(schemaSql);
    console.log('Schema created successfully.');

    // Seed default admin user
    const adminPassHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role, name)
       VALUES ('admin', $1, 'admin', 'Administrator')
       ON CONFLICT (username) DO NOTHING`,
      [adminPassHash]
    );

    // Seed default staff user
    const staffPassHash = await bcrypt.hash('staff123', 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role, name)
       VALUES ('staff', $1, 'staff', 'Ramesh Collector')
       ON CONFLICT (username) DO NOTHING`,
      [staffPassHash]
    );

    // Seed default customer user (username is their mobile number)
    const customerPassHash = await bcrypt.hash('customer123', 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role, name)
       VALUES ('9876543211', $1, 'customer', 'Arun Kumar')
       ON CONFLICT (username) DO NOTHING`,
      [customerPassHash]
    );

    // Seed settings
    const defaultSettings = [
      { key: 'business_name', value: 'Sri Murugan Finance' },
      { key: 'business_address', value: 'Main Road, Villupuram, Tamil Nadu' },
      { key: 'business_phone', value: '+91 9876543210' },
      { key: 'interest_rate_default', value: '2' },
      { key: 'language_default', value: 'en' }
    ];

    for (const setting of defaultSettings) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [setting.key, setting.value]
      );
    }

    console.log('PostgreSQL migration & seeding completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
