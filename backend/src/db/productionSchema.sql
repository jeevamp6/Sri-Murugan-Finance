-- Supabase PostgreSQL Production Schema for Sri Murugan Finance

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  alt_phone VARCHAR(20),
  address TEXT NOT NULL,
  village_area VARCHAR(100) NOT NULL,
  aadhaar VARCHAR(20) UNIQUE NOT NULL,
  pan VARCHAR(20),
  occupation VARCHAR(100),
  guarantor_name VARCHAR(255),
  guarantor_phone VARCHAR(20),
  guarantor_relation VARCHAR(100),
  photo_url TEXT,
  aadhaar_front_url TEXT,
  aadhaar_back_url TEXT,
  other_doc_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
  interest_rate DOUBLE PRECISION NOT NULL CHECK (interest_rate >= 0),
  interest_type VARCHAR(20) NOT NULL CHECK (interest_type IN ('flat', 'percentage')),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  duration INTEGER NOT NULL CHECK (duration > 0),
  processing_fee DOUBLE PRECISION DEFAULT 0 CHECK (processing_fee >= 0),
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'overdue', 'partially_paid', 'fully_paid')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collections (
  id VARCHAR(50) PRIMARY KEY,
  loan_id VARCHAR(50) NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  collected_date DATE NOT NULL,
  amount_collected DOUBLE PRECISION NOT NULL CHECK (amount_collected > 0),
  collector_name VARCHAR(255) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  remarks TEXT,
  balance_after DOUBLE PRECISION DEFAULT 0 CHECK (balance_after >= 0),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(50),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL,
  status VARCHAR(50) DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Optimize Indexing for query speed
CREATE INDEX IF NOT EXISTS idx_customers_phone_pg ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_active_pg ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_loans_customer_pg ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status_pg ON loans(status);
CREATE INDEX IF NOT EXISTS idx_collections_loan_pg ON collections(loan_id);
CREATE INDEX IF NOT EXISTS idx_collections_date_pg ON collections(collected_date);
CREATE INDEX IF NOT EXISTS idx_audit_created_pg ON audit_logs(created_at);
