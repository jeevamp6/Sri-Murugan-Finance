import express from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../config/db.js';
import { authenticateToken, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate custom Collection ID (e.g. SMR-0001)
const generateCollectionId = async () => {
  const row = await query.get("SELECT id FROM collections ORDER BY ROWID DESC LIMIT 1");
  if (!row) return "SMR-0001";
  const num = parseInt(row.id.split('-')[1]) + 1;
  return `SMR-${num.toString().padStart(4, '0')}`;
};

// Add a payment collection
router.post('/', authenticateToken, async (req, res) => {
  const { loan_id, amount_collected, collected_date, payment_method, remarks, utr } = req.body;

  if (!loan_id || !amount_collected || !collected_date || !payment_method) {
    return res.status(400).json({ error: 'Required fields missing: loan_id, amount_collected, collected_date, payment_method' });
  }

  try {
    // Get Loan details with collections to check outstanding balance
    const loan = await query.get('SELECT * FROM loans WHERE id = ?', [loan_id]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.status === 'closed') {
      return res.status(400).json({ error: 'Loan is already closed' });
    }

    // Check only verified/received collections to determine balance
    const collections = await query.all('SELECT amount_collected FROM collections WHERE loan_id = ? AND status != "pending"', [loan_id]);
    const totalCollectedSoFar = collections.reduce((acc, curr) => acc + curr.amount_collected, 0);

    const principal = loan.amount;
    let totalPayable = principal;
    if (loan.interest_type === 'flat') {
      totalPayable = principal + (principal * (loan.interest_rate / 100));
    } else {
      totalPayable = principal + (principal * (loan.interest_rate / 100) * loan.duration);
    }

    const currentBalance = totalPayable - totalCollectedSoFar;
    const payment = parseFloat(amount_collected);

    if (payment > currentBalance + 0.01) {
      return res.status(400).json({ error: `Payment amount ₹${payment} exceeds outstanding balance of ₹${currentBalance.toFixed(2)}` });
    }

    const isCustomer = req.user.role === 'customer';
    const status = isCustomer ? 'pending' : 'received';
    // For pending payments, balance_after doesn't apply yet on actual loan, but we store prospect balance
    const balanceAfter = currentBalance - payment; 
    const collectionId = await generateCollectionId();
    const collectorName = isCustomer ? 'Customer Self-Pay' : req.user.name;

    await query.run(
      `INSERT INTO collections (id, loan_id, customer_id, collected_date, amount_collected, collector_name, payment_method, remarks, balance_after, status, utr)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collectionId, loan_id, loan.customer_id, collected_date, payment, collectorName, payment_method, remarks || '', balanceAfter, status, utr || null]
    );

    // Auto-close loan if balance is fully paid (only if received immediately)
    if (status === 'received' && Math.abs(balanceAfter) < 0.01) {
      await query.run('UPDATE loans SET status = "closed", notes = "Auto-closed on full repayment" WHERE id = ?', [loan_id]);
      await logAudit('SYSTEM', 'AUTO_CLOSE_LOAN', `Loan ${loan_id} auto-closed as balance reached ₹0`);
    }

    await logAudit(req.user.username, isCustomer ? 'SUBMIT_PAYMENT_REQUEST' : 'COLLECT_PAYMENT', `${isCustomer ? 'Submitted payment request' : 'Collected'} ₹${payment} for loan ${loan_id}`);
    res.status(201).json({ message: isCustomer ? 'Payment notification submitted for verification' : 'Collection entry successful', id: collectionId, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add collection entry' });
  }
});

// Verify / Mark Payment as Received (Admin/Staff only)
router.put('/:id/verify', authenticateToken, async (req, res) => {
  if (!['super_admin', 'admin', 'family', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Privilege required to verify payments' });
  }

  try {
    const col = await query.get('SELECT * FROM collections WHERE id = ?', [req.params.id]);
    if (!col) {
      return res.status(404).json({ error: 'Collection record not found' });
    }

    if (col.status === 'received') {
      return res.status(400).json({ error: 'Collection is already marked as received' });
    }

    // Get Loan details to calculate balance
    const loan = await query.get('SELECT * FROM loans WHERE id = ?', [col.loan_id]);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found for this collection' });
    }

    // Calculate sum of other verified collections
    const collections = await query.all('SELECT amount_collected FROM collections WHERE loan_id = ? AND id != ? AND status != "pending"', [col.loan_id, col.id]);
    const totalCollectedSoFar = collections.reduce((acc, curr) => acc + curr.amount_collected, 0);

    const principal = loan.amount;
    let totalPayable = principal;
    if (loan.interest_type === 'flat') {
      totalPayable = principal + (principal * (loan.interest_rate / 100));
    } else {
      totalPayable = principal + (principal * (loan.interest_rate / 100) * loan.duration);
    }

    const currentBalance = totalPayable - totalCollectedSoFar;
    const balanceAfter = currentBalance - col.amount_collected;

    // Update collection record to received and store correct balance_after
    await query.run(
      'UPDATE collections SET status = "received", balance_after = ? WHERE id = ?',
      [balanceAfter, col.id]
    );

    // Auto-close loan if balance is fully paid
    if (Math.abs(balanceAfter) < 0.01) {
      await query.run('UPDATE loans SET status = "closed", notes = "Auto-closed on payment verification" WHERE id = ?', [col.loan_id]);
      await logAudit('SYSTEM', 'AUTO_CLOSE_LOAN', `Loan ${col.loan_id} auto-closed on verification`);
    }

    await logAudit(req.user.username, 'VERIFY_PAYMENT', `Verified payment ${col.id} of ₹${col.amount_collected}`);
    res.json({ message: 'Payment verified and marked as received successfully', balance_after: balanceAfter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// List Collections
router.get('/', authenticateToken, async (req, res) => {
  const { start_date, end_date, collector } = req.query;
  const isCustomer = req.user.role === 'customer';
  let sql = `
    SELECT col.*, cust.name as customer_name, cust.phone as customer_phone, l.amount as loan_amount, l.frequency
    FROM collections col
    JOIN customers cust ON col.customer_id = cust.id
    JOIN loans l ON col.loan_id = l.id
    WHERE 1=1
  `;
  const params = [];

  if (isCustomer) {
    sql += ' AND cust.phone = ?';
    params.push(req.user.username);
  } else {
    if (start_date) {
      sql += ' AND col.collected_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND col.collected_date <= ?';
      params.push(end_date);
    }
    if (collector) {
      sql += ' AND col.collector_name = ?';
      params.push(collector);
    }
  }

  sql += ' ORDER BY col.collected_date DESC, col.created_at DESC';

  try {
    const data = await query.all(sql, params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve collections' });
  }
});

// Generate PDF Receipt
router.get('/:id/receipt', authenticateToken, async (req, res) => {
  try {
    const col = await query.get(
      `SELECT col.*, cust.name as customer_name, cust.phone as customer_phone, cust.address as customer_address,
              l.amount as loan_amount, l.interest_rate, l.interest_type, l.frequency, l.duration
       FROM collections col
       JOIN customers cust ON col.customer_id = cust.id
       JOIN loans l ON col.loan_id = l.id
       WHERE col.id = ?`,
      [req.params.id]
    );

    if (!col) {
      return res.status(404).json({ error: 'Collection record not found' });
    }

    if (req.user.role === 'customer' && col.customer_phone !== req.user.username) {
      return res.status(403).json({ error: 'Access denied to this receipt record' });
    }

    if (col.status !== 'received') {
      return res.status(400).json({ error: 'Cannot download receipt for unverified/pending payment' });
    }

    // Get aggregate collection stats for accurate historical balance calculations
    const allColls = await query.all('SELECT id, amount_collected FROM collections WHERE loan_id = ? ORDER BY ROWID ASC', [col.loan_id]);
    
    let totalCollectedUpToThis = 0;
    for (const c of allColls) {
      totalCollectedUpToThis += c.amount_collected;
      if (c.id === col.id) {
        break;
      }
    }

    const principal = col.loan_amount;
    let totalPayable = principal;
    if (col.interest_type === 'flat') {
      totalPayable = principal + (principal * (col.interest_rate / 100));
    } else {
      totalPayable = principal + (principal * (col.interest_rate / 100) * col.duration);
    }
    
    const remainingBalance = Math.max(0, totalPayable - totalCollectedUpToThis);
    const previousBalance = remainingBalance + col.amount_collected;

    // Create PDF
    const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 30 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt-${col.id}.pdf`);

    doc.pipe(res);

    // Design layout: Gold & Dark Gray thematic receipt
    // Border
    doc.rect(15, 15, doc.page.width - 30, doc.page.height - 30).lineWidth(1.5).stroke('#C29B38');

    // Drawing the Logo Crest (Stylized Golden Shield)
    doc.save();
    doc.translate(45, 23);
    doc.path('M 0 0 L 10 -6 L 20 0 L 20 14 C 20 20 10 26 10 26 C 10 26 0 20 0 14 Z')
       .fillColor('#C29B38')
       .fill();
    doc.restore();

    // Header Title and Subtitles
    doc.fillColor('#1A1A1A').fontSize(16).text('SRI MURUGAN FINANCE', 80, 22, { bold: true });
    doc.fontSize(8).fillColor('#666666').text('Family-Operated Personal Lending Business | Villupuram, Tamil Nadu', 80, 40);
    doc.text('Phone: +91 9876543210 | Email: support@srimuruganfinance.in', 80, 50);
    
    doc.moveDown(1.5);
    doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(30, 68).lineTo(doc.page.width - 30, 68).stroke();

    // Invoice details columns
    const topY = 80;
    doc.fontSize(9).fillColor('#1A1A1A');
    doc.text(`Receipt Number: ${col.id}`, 30, topY, { bold: true });
    doc.text(`Date & Time: ${col.collected_date}`, 30, topY + 15);
    doc.text(`Collector Name: ${col.collector_name}`, 30, topY + 30);

    doc.text(`Customer Name: ${col.customer_name}`, 220, topY, { bold: true });
    doc.text(`Loan Reference ID: ${col.loan_id}`, 220, topY + 15);
    doc.text(`Payment Method: ${col.payment_method.toUpperCase()}`, 220, topY + 30, { bold: true });

    doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(30, 130).lineTo(doc.page.width - 30, 130).stroke();

    // Financial Breakdown
    const breakY = 140;
    doc.fontSize(9).fillColor('#666666');
    doc.text('Original Loan', 30, breakY);
    doc.text('Previous Balance', 120, breakY);
    doc.text('Amount Paid', 220, breakY, { bold: true });
    doc.text('Current Balance', 320, breakY, { bold: true });

    doc.fontSize(11).fillColor('#1A1A1A');
    doc.text(`₹${col.loan_amount.toLocaleString('en-IN')}`, 30, breakY + 15);
    doc.text(`₹${previousBalance.toLocaleString('en-IN')}`, 120, breakY + 15);
    doc.fillColor('#10B981').text(`₹${col.amount_collected.toLocaleString('en-IN')}`, 220, breakY + 15, { bold: true });
    doc.fillColor('#EF4444').text(`₹${remainingBalance.toLocaleString('en-IN')}`, 320, breakY + 15, { bold: true });

    // Signature Block
    const sigY = doc.page.height - 65;
    doc.fontSize(8).fillColor('#666666');
    doc.text('Customer Signature', 50, sigY);
    doc.text('Authorized Signatory', doc.page.width - 160, sigY);
    
    doc.strokeColor('#999999').lineWidth(0.5);
    doc.moveTo(40, sigY - 5).lineTo(130, sigY - 5).stroke();
    doc.moveTo(doc.page.width - 170, sigY - 5).lineTo(doc.page.width - 50, sigY - 5).stroke();

    doc.fontSize(7).fillColor('#999999').text('Thank you for your business. This is a computer-generated transaction receipt.', 30, doc.page.height - 25, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF receipt' });
  }
});

export default router;
