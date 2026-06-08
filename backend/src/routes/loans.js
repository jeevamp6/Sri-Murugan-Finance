import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken, requireAdmin, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate custom Loan ID (e.g. SML-0001)
const generateLoanId = async () => {
  const row = await query.get("SELECT id FROM loans ORDER BY ROWID DESC LIMIT 1");
  if (!row) return "SML-0001";
  const num = parseInt(row.id.split('-')[1]) + 1;
  return `SML-${num.toString().padStart(4, '0')}`;
};

// Create a Loan
router.post('/', authenticateToken, async (req, res) => {
  const { customer_id, amount, interest_rate, interest_type, frequency, duration, processing_fee, start_date, notes } = req.body;

  if (!customer_id || !amount || !interest_rate || !interest_type || !frequency || !duration || !start_date) {
    return res.status(400).json({ error: 'Required fields missing: customer_id, amount, interest_rate, interest_type, frequency, duration, start_date' });
  }

  try {
    const customer = await query.get('SELECT name FROM customers WHERE id = ?', [customer_id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const loanId = await generateLoanId();
    
    // Calculate due date based on frequency and duration
    const startDateObj = new Date(start_date);
    const dueDateObj = new Date(start_date);

    if (frequency === 'daily') {
      dueDateObj.setDate(startDateObj.getDate() + parseInt(duration));
    } else if (frequency === 'weekly') {
      dueDateObj.setDate(startDateObj.getDate() + parseInt(duration) * 7);
    } else if (frequency === 'monthly') {
      dueDateObj.setMonth(startDateObj.getMonth() + parseInt(duration));
    }

    const due_date = dueDateObj.toISOString().split('T')[0];

    await query.run(
      `INSERT INTO loans (id, customer_id, amount, interest_rate, interest_type, frequency, duration, processing_fee, start_date, due_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [loanId, customer_id, parseFloat(amount), parseFloat(interest_rate), interest_type, frequency, parseInt(duration), parseFloat(processing_fee || 0), start_date, due_date, notes || '']
    );

    await logAudit(req.user.username, 'CREATE_LOAN', `Disbursed loan ${loanId} of ₹${amount} to customer ${customer.name}`);
    res.status(201).json({ message: 'Loan created successfully', id: loanId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

// List Loans with calculations
router.get('/', authenticateToken, async (req, res) => {
  const { status, customer_id } = req.query;
  const isCustomer = req.user.role === 'customer';
  let sql = `
    SELECT l.*, c.name as customer_name, c.phone as customer_phone,
    (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as total_collected
    FROM loans l
    JOIN customers c ON l.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (isCustomer) {
    sql += ' AND c.phone = ?';
    params.push(req.user.username);
  } else {
    if (status) {
      sql += ' AND l.status = ?';
      params.push(status);
    }
    if (customer_id) {
      sql += ' AND l.customer_id = ?';
      params.push(customer_id);
    }
  }

  sql += ' ORDER BY l.start_date DESC';

  try {
    const loans = await query.all(sql, params);
    
    // Apply calculations to loans dynamically
    const enrichedLoans = loans.map(loan => {
      const principal = loan.amount;
      const totalCollected = loan.total_collected || 0;
      let totalPayable = principal;

      if (loan.interest_type === 'flat') {
        // Flat interest represents direct total interest amount or fixed interest rate
        // We'll calculate interest as: Principal * (Rate / 100) total interest
        const totalInterest = principal * (loan.interest_rate / 100);
        totalPayable = principal + totalInterest;
      } else {
        // Percentage based: Monthly rate or per installment
        // Let's compute based on rate per frequency term
        const totalInterest = principal * (loan.interest_rate / 100) * loan.duration;
        totalPayable = principal + totalInterest;
      }

      const balance = Math.max(0, totalPayable - totalCollected);
      
      // Calculate installments details
      const installmentAmount = totalPayable / loan.duration;
      
      return {
        ...loan,
        total_payable: totalPayable,
        total_collected: totalCollected,
        balance: balance,
        installment_amount: parseFloat(installmentAmount.toFixed(2)),
        interest_earned: totalPayable - principal
      };
    });

    res.json(enrichedLoans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Get Loan details with collections schedule
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const loan = await query.get(
      `SELECT l.*, c.name as customer_name, c.phone as customer_phone, c.village_area as customer_area
       FROM loans l
       JOIN customers c ON l.customer_id = c.id
       WHERE l.id = ?`,
      [req.params.id]
    );

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (req.user.role === 'customer' && loan.customer_phone !== req.user.username) {
      return res.status(403).json({ error: 'Access denied to this loan record' });
    }

    const collections = await query.all(
      'SELECT * FROM collections WHERE loan_id = ? ORDER BY collected_date DESC',
      [req.params.id]
    );

    // Calculate balances
    const principal = loan.amount;
    const totalCollected = collections.reduce((acc, curr) => acc + curr.amount_collected, 0);
    let totalPayable = principal;

    if (loan.interest_type === 'flat') {
      const totalInterest = principal * (loan.interest_rate / 100);
      totalPayable = principal + totalInterest;
    } else {
      const totalInterest = principal * (loan.interest_rate / 100) * loan.duration;
      totalPayable = principal + totalInterest;
    }

    const balance = Math.max(0, totalPayable - totalCollected);
    const installmentAmount = totalPayable / loan.duration;

    res.json({
      loan: {
        ...loan,
        total_payable: totalPayable,
        total_collected: totalCollected,
        balance: balance,
        installment_amount: parseFloat(installmentAmount.toFixed(2)),
        interest_earned: totalPayable - principal
      },
      collections
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve loan details' });
  }
});

// Close / Modify Loan status
router.put('/:id/close', authenticateToken, async (req, res) => {
  const { notes } = req.body;
  try {
    const loan = await query.get('SELECT status FROM loans WHERE id = ?', [req.params.id]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    await query.run(
      'UPDATE loans SET status = "closed", notes = ? WHERE id = ?',
      [notes || 'Closed', req.params.id]
    );

    await logAudit(req.user.username, 'CLOSE_LOAN', `Closed loan ${req.params.id}`);
    res.json({ message: 'Loan closed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to close loan' });
  }
});

// Delete Loan (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const loan = await query.get('SELECT id FROM loans WHERE id = ?', [req.params.id]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    await query.run('DELETE FROM loans WHERE id = ?', [req.params.id]);
    await logAudit(req.user.username, 'DELETE_LOAN', `Deleted loan ${req.params.id}`);

    res.json({ message: 'Loan deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete loan' });
  }
});

export default router;
