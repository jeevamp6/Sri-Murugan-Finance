import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
console.log('Seeding sample data into database at:', dbPath);

const db = new sqlite3.Database(dbPath);

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

async function seed() {
  try {
    // Clear old data (except users and settings)
    await runQuery('DELETE FROM collections');
    await runQuery('DELETE FROM loans');
    await runQuery('DELETE FROM customers');
    await runQuery('DELETE FROM audit_logs');

    // 1. Seed Customers
    const customers = [
      {
        id: 'SMC-0001',
        name: 'Arun Kumar',
        phone: '9876543211',
        alt_phone: '9876543212',
        address: '12, Gandhi Street, Villupuram',
        village_area: 'Villupuram Town',
        aadhaar: '1234-5678-9012',
        pan: 'ABCDE1234F',
        occupation: 'Grocery Store Owner',
        guarantor_name: 'Rajesh Kumar',
        guarantor_phone: '9876543213',
        guarantor_relation: 'Brother'
      },
      {
        id: 'SMC-0002',
        name: 'Meenakshi Sundaram',
        phone: '8765432109',
        alt_phone: '',
        address: '45, Temple View St, Thirukovilur',
        village_area: 'Thirukovilur',
        aadhaar: '9876-5432-1098',
        pan: 'XYZWR9876A',
        occupation: 'Teacher',
        guarantor_name: 'Sundarraman',
        guarantor_phone: '8765432108',
        guarantor_relation: 'Father'
      },
      {
        id: 'SMC-0003',
        name: 'Karthikeyan P',
        phone: '7654321098',
        alt_phone: '7654321099',
        address: '8, Nehru Bazaar, Valavanur',
        village_area: 'Valavanur',
        aadhaar: '4567-8901-2345',
        pan: 'KLMNO4567Z',
        occupation: 'Farmer',
        guarantor_name: 'Palanivel',
        guarantor_phone: '7654321097',
        guarantor_relation: 'Uncle'
      }
    ];

    for (const c of customers) {
      await runQuery(
        `INSERT INTO customers (id, name, phone, alt_phone, address, village_area, aadhaar, pan, occupation, guarantor_name, guarantor_phone, guarantor_relation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.phone, c.alt_phone, c.address, c.village_area, c.aadhaar, c.pan, c.occupation, c.guarantor_name, c.guarantor_phone, c.guarantor_relation]
      );
    }
    console.log('Customers seeded.');

    // 2. Seed Loans
    const loans = [
      {
        id: 'SML-0001',
        customer_id: 'SMC-0001',
        amount: 20000,
        interest_rate: 2, // 2% per month
        interest_type: 'percentage',
        frequency: 'monthly',
        duration: 10, // 10 months
        processing_fee: 200,
        start_date: '2026-01-10',
        due_date: '2026-11-10',
        status: 'active',
        notes: 'Grocery store expansion'
      },
      {
        id: 'SML-0002',
        customer_id: 'SMC-0002',
        amount: 10000,
        interest_rate: 10, // ₹1,000 flat interest
        interest_type: 'flat',
        frequency: 'weekly',
        duration: 20, // 20 weeks
        processing_fee: 100,
        start_date: '2026-03-01',
        due_date: '2026-07-19',
        status: 'active',
        notes: 'School semester fees'
      },
      {
        id: 'SML-0003',
        customer_id: 'SMC-0003',
        amount: 5000,
        interest_rate: 5,
        interest_type: 'percentage',
        frequency: 'daily',
        duration: 50, // 50 days
        processing_fee: 50,
        start_date: '2026-05-01',
        due_date: '2026-06-20',
        status: 'active',
        notes: 'Farming seeds procurement'
      }
    ];

    for (const l of loans) {
      await runQuery(
        `INSERT INTO loans (id, customer_id, amount, interest_rate, interest_type, frequency, duration, processing_fee, start_date, due_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.id, l.customer_id, l.amount, l.interest_rate, l.interest_type, l.frequency, l.duration, l.processing_fee, l.start_date, l.due_date, l.status, l.notes]
      );
    }
    console.log('Loans seeded.');

    // 3. Seed Collections
    const collections = [
      // SML-0001 (Monthly, installment is: 20000 + (20000*0.02*10) = 24000 total. Installment = 2400 per month)
      // Seed 4 repayments
      { id: 'SMR-0001', loan_id: 'SML-0001', customer_id: 'SMC-0001', collected_date: '2026-02-10', amount_collected: 2400, collector_name: 'Administrator', payment_method: 'cash', remarks: 'First month repayment' },
      { id: 'SMR-0002', loan_id: 'SML-0001', customer_id: 'SMC-0001', collected_date: '2026-03-10', amount_collected: 2400, collector_name: 'Administrator', payment_method: 'upi', remarks: 'Second month repayment' },
      { id: 'SMR-0003', loan_id: 'SML-0001', customer_id: 'SMC-0001', collected_date: '2026-04-10', amount_collected: 2400, collector_name: 'Administrator', payment_method: 'bank_transfer', remarks: 'Third month repayment' },
      { id: 'SMR-0004', loan_id: 'SML-0001', customer_id: 'SMC-0001', collected_date: '2026-05-10', amount_collected: 2400, collector_name: 'Administrator', payment_method: 'cash', remarks: 'Fourth month repayment' },

      // SML-0002 (Weekly, Flat interest 10% on 10000 = 11000 total. Installment = 550 per week)
      // Seed 5 repayments
      { id: 'SMR-0005', loan_id: 'SML-0002', customer_id: 'SMC-0002', collected_date: '2026-03-08', amount_collected: 550, collector_name: 'Administrator', payment_method: 'cash', remarks: 'Week 1' },
      { id: 'SMR-0006', loan_id: 'SML-0002', customer_id: 'SMC-0002', collected_date: '2026-03-15', amount_collected: 550, collector_name: 'Administrator', payment_method: 'cash', remarks: 'Week 2' },
      { id: 'SMR-0007', loan_id: 'SML-0002', customer_id: 'SMC-0002', collected_date: '2026-03-22', amount_collected: 550, collector_name: 'Administrator', payment_method: 'upi', remarks: 'Week 3' },

      // SML-0003 (Daily, 5% percentage interest per term. 5000 + 5000*0.05*50 = 17500 total... Wait, daily percentage duration is high. That is fine, 350 per day)
      // Seed 2 repayments
      { id: 'SMR-0008', loan_id: 'SML-0003', customer_id: 'SMC-0003', collected_date: '2026-05-02', amount_collected: 350, collector_name: 'Administrator', payment_method: 'cash', remarks: 'Day 1' },
      { id: 'SMR-0009', loan_id: 'SML-0003', customer_id: 'SMC-0003', collected_date: '2026-05-03', amount_collected: 350, collector_name: 'Administrator', payment_method: 'cash', remarks: 'Day 2' }
    ];

    for (const c of collections) {
      await runQuery(
        `INSERT INTO collections (id, loan_id, customer_id, collected_date, amount_collected, collector_name, payment_method, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.loan_id, c.customer_id, c.collected_date, c.amount_collected, c.collector_name, c.payment_method, c.remarks]
      );
    }
    console.log('Collections seeded.');

    // 4. Seed Audit Logs
    await runQuery(
      `INSERT INTO audit_logs (username, action, details)
       VALUES ('admin', 'SYSTEM_SEED', 'Successfully seeded rich sample customers, loans, and collection repayment logs.')`
    );

    console.log('Data Seeding Finished Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
