-- Database schema for Sri Murugan Finance

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'family', 'staff', 'customer')),
  name TEXT NOT NULL,
  is_disabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, -- Custom ID like SMC-0001
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  address TEXT NOT NULL,
  village_area TEXT NOT NULL,
  aadhaar TEXT NOT NULL,
  pan TEXT,
  occupation TEXT,
  guarantor_name TEXT,
  guarantor_phone TEXT,
  guarantor_relation TEXT,
  photo_url TEXT,
  aadhaar_front_url TEXT,
  aadhaar_back_url TEXT,
  other_doc_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Loans table
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY, -- Custom ID like SML-0001
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL,
  interest_rate REAL NOT NULL,
  interest_type TEXT NOT NULL CHECK(interest_type IN ('flat', 'percentage')),
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
  duration INTEGER NOT NULL, -- in days, weeks, or months
  processing_fee REAL DEFAULT 0,
  start_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY, -- Custom ID like SMR-0001
  loan_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  collected_date TEXT NOT NULL,
  amount_collected REAL NOT NULL,
  collector_name TEXT NOT NULL,
  payment_method TEXT NOT NULL, -- 'cash', 'upi', 'bank_transfer'
  remarks TEXT,
  balance_after REAL DEFAULT 0,
  status TEXT DEFAULT 'received' CHECK(status IN ('received', 'pending')),
  utr TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT,
  device_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_collections_loan ON collections(loan_id);
CREATE INDEX IF NOT EXISTS idx_collections_date ON collections(collected_date);
