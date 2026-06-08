import express from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to fetch today's date formatted as YYYY-MM-DD
const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

// Dashboard / Business Analytics Summary
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const today = getTodayDateString();

    // 1. Total Loans Disbursed
    const loans = await query.all('SELECT * FROM loans');
    const totalCollectedRow = await query.get('SELECT SUM(amount_collected) as val FROM collections');
    const totalCollected = totalCollectedRow.val || 0;

    let totalLent = 0;
    let totalPayable = 0;
    let totalProcessingFees = 0;

    loans.forEach(loan => {
      totalLent += loan.amount;
      totalProcessingFees += loan.processing_fee || 0;
      
      let payable = loan.amount;
      if (loan.interest_type === 'flat') {
        payable = loan.amount + (loan.amount * (loan.interest_rate / 100));
      } else {
        payable = loan.amount + (loan.amount * (loan.interest_rate / 100) * loan.duration);
      }
      totalPayable += payable;
    });

    const totalOutstanding = Math.max(0, totalPayable - totalCollected);

    // 2. Today's Collections
    const todayCollectionsRow = await query.get('SELECT SUM(amount_collected) as val FROM collections WHERE collected_date = ?', [today]);
    const todayCollections = todayCollectionsRow.val || 0;

    // 3. Upcoming Due Collections (within next 7 days)
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];

    const upcomingDuesRow = await query.all(
      `SELECT l.*, c.name as customer_name, c.phone as customer_phone
       FROM loans l
       JOIN customers c ON l.customer_id = c.id
       WHERE l.status = 'active' AND l.due_date >= ? AND l.due_date <= ?`,
      [today, sevenDaysLaterStr]
    );

    // 4. Overdue Accounts Count and Total Overdue Amount
    const activeLoans = await query.all(
      `SELECT l.*, c.name as customer_name,
       (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as collected
       FROM loans l
       JOIN customers c ON l.customer_id = c.id
       WHERE l.status = 'active' AND l.due_date < ?`,
      [today]
    );

    let overdueCount = 0;
    let totalOverdueAmount = 0;
    const defaultersList = [];

    activeLoans.forEach(loan => {
      const principal = loan.amount;
      let payable = principal;
      if (loan.interest_type === 'flat') {
        payable = principal + (principal * (loan.interest_rate / 100));
      } else {
        payable = principal + (principal * (loan.interest_rate / 100) * loan.duration);
      }
      const collected = loan.collected || 0;
      const balance = payable - collected;

      if (balance > 0) {
        overdueCount++;
        totalOverdueAmount += balance;
        
        // Calculate days overdue
        const dueDate = new Date(loan.due_date);
        const timeDiff = new Date() - dueDate;
        const daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        defaultersList.push({
          loan_id: loan.id,
          customer_name: loan.customer_name,
          amount: loan.amount,
          due_date: loan.due_date,
          amount_overdue: balance,
          days_overdue: daysOverdue
        });
      }
    });

    // 5. Profit Summary (Interest Earned + Processing Fees)
    const interestEarned = totalPayable - totalLent;
    const totalProfit = interestEarned + totalProcessingFees;

    // 6. Recent collections (last 5)
    const recentCollections = await query.all(
      `SELECT col.*, cust.name as customer_name
       FROM collections col
       JOIN customers cust ON col.customer_id = cust.id
       ORDER BY col.collected_date DESC, col.created_at DESC
       LIMIT 5`
    );

    // 7. Monthly Collection Chart Data (grouped by month/week for the last 6 months)
    const monthlyStats = await query.all(
      `SELECT substr(collected_date, 1, 7) as month, SUM(amount_collected) as amount
       FROM collections
       GROUP BY month
       ORDER BY month DESC
       LIMIT 6`
    );

    // Get closed loans count
    const closedLoansCountRow = await query.get('SELECT COUNT(*) as val FROM loans WHERE status = "closed"');
    const closedLoansCount = closedLoansCountRow.val || 0;

    // Calculate pending collections for today:
    // Let's assume daily/weekly/monthly installment portion due today is the sum of daily installments for active daily loans,
    // plus weekly installments for active weekly loans due this week, etc.
    // To make it simple and reliable: Today's scheduled collections is the sum of installment_amounts for active loans.
    // If today is Sunday, we can assume weekly/monthly are not due, or just sum up installment_amount for active daily loans,
    // and weekly/monthly loans if they fall on their collection days.
    // A clean, standard formula: Pending Collections Today = (Sum of installment_amount of active daily loans) - (Today's Collections).
    // Let's compute this dynamically:
    const activeDailyLoans = await query.all('SELECT amount, interest_rate, interest_type, duration, frequency FROM loans WHERE status = "active"');
    let expectedToday = 0;
    activeDailyLoans.forEach(loan => {
      const principal = loan.amount;
      let totalPayable = principal;
      if (loan.interest_type === 'flat') {
        totalPayable = principal + (principal * (loan.interest_rate / 100));
      } else {
        totalPayable = principal + (principal * (loan.interest_rate / 100) * loan.duration);
      }
      const termAmount = totalPayable / loan.duration;
      // Daily loans are collected every day
      if (loan.frequency === 'daily') {
        expectedToday += termAmount;
      } else if (loan.frequency === 'weekly') {
        // Assume 1/7 of weekly installment is expected per day on average, or if today is due date
        expectedToday += termAmount / 7;
      } else if (loan.frequency === 'monthly') {
        expectedToday += termAmount / 30;
      }
    });

    const pendingCollections = Math.max(0, expectedToday - todayCollections);

    res.json({
      summary: {
        total_money_lent: totalLent,
        total_money_collected: totalCollected,
        total_outstanding: totalOutstanding,
        today_collections: todayCollections,
        pending_collections: parseFloat(pendingCollections.toFixed(2)),
        upcoming_dues_count: upcomingDuesRow.length,
        overdue_accounts_count: overdueCount,
        total_overdue_amount: totalOverdueAmount,
        monthly_profit: totalProfit,
        processing_fees: totalProcessingFees,
        fully_paid_loans_count: closedLoansCount
      },
      upcoming_dues: upcomingDuesRow.slice(0, 5),
      defaulters: defaultersList.sort((a, b) => b.amount_overdue - a.amount_overdue).slice(0, 10), // Top Defaulters sorted descending
      recent_activities: recentCollections,
      collection_trends: monthlyStats.reverse()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve dashboard analytics' });
  }
});

// Advanced Reports API
router.get('/report', authenticateToken, async (req, res) => {
  const { type, start_date, end_date } = req.query;

  try {
    if (type === 'collections') {
      const sql = `
        SELECT c.id as collection_id, c.collected_date, c.amount_collected, c.collector_name, c.payment_method,
               cust.name as customer_name, cust.phone as customer_phone, c.loan_id
        FROM collections c
        JOIN customers cust ON c.customer_id = cust.id
        WHERE c.collected_date BETWEEN ? AND ?
        ORDER BY c.collected_date DESC
      `;
      const data = await query.all(sql, [start_date, end_date]);
      return res.json(data);
    }

    if (type === 'outstanding') {
      const sql = `
        SELECT l.id as loan_id, l.amount as loan_amount, l.interest_rate, l.interest_type, l.start_date, l.due_date,
               cust.name as customer_name, cust.phone as customer_phone,
               (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as collected
        FROM loans l
        JOIN customers cust ON l.customer_id = cust.id
        WHERE l.status = 'active'
        ORDER BY l.due_date ASC
      `;
      const activeLoans = await query.all(sql);
      const data = activeLoans.map(loan => {
        const principal = loan.loan_amount;
        let payable = principal;
        if (loan.interest_type === 'flat') {
          payable = principal + (principal * (loan.interest_rate / 100));
        } else {
          payable = principal + (principal * (loan.interest_rate / 100) * 12); // standard period
        }
        const collected = loan.collected || 0;
        const outstanding = payable - collected;

        return {
          ...loan,
          total_payable: payable,
          total_collected: collected,
          outstanding_amount: outstanding
        };
      });
      return res.json(data);
    }

    if (type === 'defaulters') {
      const today = getTodayDateString();
      const sql = `
        SELECT l.id as loan_id, l.amount as loan_amount, l.due_date, l.interest_type, l.interest_rate,
               cust.name as customer_name, cust.phone as customer_phone, cust.village_area,
               (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as collected
        FROM loans l
        JOIN customers cust ON l.customer_id = cust.id
        WHERE l.status = 'active' AND l.due_date < ?
        ORDER BY l.due_date ASC
      `;
      const activeLoans = await query.all(sql, [today]);
      const data = [];

      activeLoans.forEach(loan => {
        const principal = loan.loan_amount;
        let payable = principal;
        if (loan.interest_type === 'flat') {
          payable = principal + (principal * (loan.interest_rate / 100));
        } else {
          payable = principal + (principal * (loan.interest_rate / 100) * 12);
        }
        const collected = loan.collected || 0;
        const balance = payable - collected;

        if (balance > 0) {
          const dueDate = new Date(loan.due_date);
          const timeDiff = new Date() - dueDate;
          const daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

          data.push({
            ...loan,
            total_payable: payable,
            total_collected: collected,
            amount_overdue: balance,
            days_overdue: daysOverdue
          });
        }
      });

      return res.json(data);
    }

    if (type === 'profit') {
      const collections = await query.get('SELECT SUM(amount_collected) as val FROM collections WHERE collected_date BETWEEN ? AND ?', [start_date, end_date]);
      const loans = await query.all('SELECT amount, processing_fee, interest_rate, interest_type, duration FROM loans WHERE start_date BETWEEN ? AND ?', [start_date, end_date]);
      
      let totalLent = 0;
      let totalProcessingFees = 0;
      let interestExpected = 0;

      loans.forEach(loan => {
        totalLent += loan.amount;
        totalProcessingFees += loan.processing_fee || 0;
        let payable = loan.amount;
        if (loan.interest_type === 'flat') {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100));
        } else {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100) * loan.duration);
        }
        interestExpected += (payable - loan.amount);
      });

      const data = {
        total_lent: totalLent,
        total_collected: collections.val || 0,
        processing_fees: totalProcessingFees,
        interest_expected: interestExpected,
        net_profit: (collections.val || 0) + totalProcessingFees - totalLent
      };
      return res.json([data]);
    }

    if (type === 'history') {
      const sql = `
        SELECT 'PAYMENT' as activity_type, col.id, col.collected_date as date, col.amount_collected as amount,
               cust.name as customer_name, col.collector_name as details
        FROM collections col
        JOIN customers cust ON col.customer_id = cust.id
        WHERE col.collected_date BETWEEN ? AND ?
        UNION ALL
        SELECT 'AUDIT' as activity_type, id, created_at as date, 0 as amount,
               username as customer_name, action || ': ' || details as details
        FROM audit_logs
        WHERE created_at BETWEEN ? AND ?
        ORDER BY date DESC
      `;
      const data = await query.all(sql, [start_date, end_date, start_date, end_date]);
      return res.json(data);
    }

    res.status(400).json({ error: 'Invalid report type' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// CSV Export route representation
router.get('/export/csv', authenticateToken, async (req, res) => {
  const { type, start_date, end_date } = req.query;
  try {
    let headers = '';
    let rows = [];

    if (type === 'collections') {
      headers = 'Collection ID,Date,Amount,Collector,Method,Customer Name,Loan ID\n';
      const sql = `
        SELECT c.id, c.collected_date, c.amount_collected, c.collector_name, c.payment_method,
               cust.name as customer_name, c.loan_id
        FROM collections c
        JOIN customers cust ON c.customer_id = cust.id
        WHERE c.collected_date BETWEEN ? AND ?
        ORDER BY c.collected_date DESC
      `;
      const data = await query.all(sql, [start_date || '2000-01-01', end_date || '2100-01-01']);
      rows = data.map(item => `"${item.id}","${item.collected_date}",${item.amount_collected},"${item.collector_name}","${item.payment_method}","${item.customer_name}","${item.loan_id}"`);
    } else if (type === 'defaulters') {
      headers = 'Loan ID,Customer Name,Phone,Area,Due Date,Loan Amount,Amount Overdue,Days Overdue\n';
      const today = getTodayDateString();
      const sql = `
        SELECT l.id, l.amount, l.due_date, l.interest_type, l.interest_rate,
               cust.name as customer_name, cust.phone, cust.village_area,
               (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as collected
        FROM loans l
        JOIN customers cust ON l.customer_id = cust.id
        WHERE l.status = 'active' AND l.due_date < ?
      `;
      const dataRaw = await query.all(sql, [today]);
      dataRaw.forEach(loan => {
        let payable = loan.amount;
        if (loan.interest_type === 'flat') {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100));
        } else {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100) * 12);
        }
        const collected = loan.collected || 0;
        const balance = payable - collected;
        if (balance > 0) {
          const days = Math.floor((new Date() - new Date(loan.due_date)) / (1000 * 60 * 60 * 24));
          rows.push(`"${loan.id}","${loan.customer_name}","${loan.phone}","${loan.village_area}","${loan.due_date}",${loan.amount},${balance.toFixed(2)},${days}`);
        }
      });
    } else if (type === 'outstanding') {
      headers = 'Loan ID,Customer Name,Phone,Loan Amount,Total Payable,Total Collected,Outstanding Balance,Due Date\n';
      const sql = `
        SELECT l.id, l.amount, l.interest_rate, l.interest_type, l.start_date, l.due_date,
               cust.name as customer_name, cust.phone,
               (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as collected
        FROM loans l
        JOIN customers cust ON l.customer_id = cust.id
        WHERE l.status = 'active'
        ORDER BY l.due_date ASC
      `;
      const activeLoans = await query.all(sql);
      activeLoans.forEach(loan => {
        const principal = loan.amount;
        let payable = principal;
        if (loan.interest_type === 'flat') {
          payable = principal + (principal * (loan.interest_rate / 100));
        } else {
          payable = principal + (principal * (loan.interest_rate / 100) * 12);
        }
        const collected = loan.collected || 0;
        const outstanding = payable - collected;
        rows.push(`"${loan.id}","${loan.customer_name}","${loan.phone}",${principal},${payable},${collected},${outstanding},"${loan.due_date}"`);
      });
    } else if (type === 'profit') {
      headers = 'Total Money Lent,Total Repayments Collected,Total Processing Fees,Expected Interest,Net Profit Margin\n';
      const collections = await query.get('SELECT SUM(amount_collected) as val FROM collections WHERE collected_date BETWEEN ? AND ?', [start_date || '2000-01-01', end_date || '2100-01-01']);
      const loans = await query.all('SELECT amount, processing_fee, interest_rate, interest_type, duration FROM loans WHERE start_date BETWEEN ? AND ?', [start_date || '2000-01-01', end_date || '2100-01-01']);
      
      let totalLent = 0;
      let totalProcessingFees = 0;
      let interestExpected = 0;

      loans.forEach(loan => {
        totalLent += loan.amount;
        totalProcessingFees += loan.processing_fee || 0;
        let payable = loan.amount;
        if (loan.interest_type === 'flat') {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100));
        } else {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100) * loan.duration);
        }
        interestExpected += (payable - loan.amount);
      });

      const netProfit = (collections.val || 0) + totalProcessingFees - totalLent;
      rows.push(`${totalLent},${collections.val || 0},${totalProcessingFees},${interestExpected},${netProfit}`);
    } else if (type === 'history') {
      headers = 'Activity Type,Reference ID,Date/Time,Amount,User/Customer,Details\n';
      const sql = `
        SELECT 'PAYMENT' as activity_type, col.id, col.collected_date as date, col.amount_collected as amount,
               cust.name as customer_name, col.collector_name as details
        FROM collections col
        JOIN customers cust ON col.customer_id = cust.id
        WHERE col.collected_date BETWEEN ? AND ?
        UNION ALL
        SELECT 'AUDIT' as activity_type, id, created_at as date, 0 as amount,
               username as customer_name, action || ': ' || details as details
        FROM audit_logs
        WHERE created_at BETWEEN ? AND ?
        ORDER BY date DESC
      `;
      const data = await query.all(sql, [start_date || '2000-01-01', end_date || '2100-01-01', start_date || '2000-01-01', end_date || '2100-01-01']);
      rows = data.map(item => `"${item.activity_type}","${item.id}","${item.date}",${item.amount},"${item.customer_name}","${item.details.replace(/"/g, '""')}"`);
    } else {
      return res.status(400).json({ error: 'CSV export type not supported' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Report-${type}-${Date.now()}.csv`);
    res.send(headers + rows.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CSV export failed' });
  }
});

// PDF Export route
router.get('/export/pdf', authenticateToken, async (req, res) => {
  const { type, start_date, end_date } = req.query;
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Report-${type}-${Date.now()}.pdf`);
    doc.pipe(res);

    // Header Golden Emblem
    doc.save();
    doc.translate(40, 35);
    doc.path('M 0 0 L 10 -6 L 20 0 L 20 14 C 20 20 10 26 10 26 C 10 26 0 20 0 14 Z')
       .fillColor('#C29B38')
       .fill();
    doc.restore();

    doc.fillColor('#1A1A1A').fontSize(16).text('SRI MURUGAN FINANCE', 75, 33, { bold: true });
    doc.fontSize(8).fillColor('#666666').text('Family-Operated Personal Lending Business | Villupuram, Tamil Nadu', 75, 50);
    doc.text(`REPORT: ${type.toUpperCase()} | PERIOD: ${start_date || 'ALL'} to ${end_date || 'ALL'}`, 75, 60);

    doc.strokeColor('#C29B38').lineWidth(1.5).moveTo(40, 75).lineTo(doc.page.width - 40, 75).stroke();

    let y = 100;

    if (type === 'collections') {
      const sql = `
        SELECT c.id, c.collected_date, c.amount_collected, c.collector_name, c.payment_method,
               cust.name as customer_name, c.loan_id
        FROM collections c
        JOIN customers cust ON c.customer_id = cust.id
        WHERE c.collected_date BETWEEN ? AND ?
        ORDER BY c.collected_date DESC
      `;
      const data = await query.all(sql, [start_date || '2000-01-01', end_date || '2100-01-01']);

      // Draw table headers
      doc.fontSize(8).fillColor('#1A1A1A').text('Date', 40, y, { bold: true });
      doc.text('Collection ID', 110, y, { bold: true });
      doc.text('Customer Name', 200, y, { bold: true });
      doc.text('Loan ID', 320, y, { bold: true });
      doc.text('Method', 380, y, { bold: true });
      doc.text('Amount', 460, y, { align: 'right', bold: true });

      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(40, y + 12).lineTo(doc.page.width - 40, y + 12).stroke();
      y += 20;

      data.forEach(item => {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 50;
        }
        doc.fontSize(8).fillColor('#444444').text(item.collected_date, 40, y);
        doc.text(item.id, 110, y);
        doc.text(item.customer_name, 200, y);
        doc.text(item.loan_id, 320, y);
        doc.text(item.payment_method.toUpperCase(), 380, y);
        doc.fillColor('#10B981').text(`₹${item.amount_collected}`, 400, y, { align: 'right' });
        y += 15;
      });
    } else if (type === 'defaulters') {
      const today = getTodayDateString();
      const sql = `
        SELECT l.id, l.amount, l.due_date, l.interest_type, l.interest_rate,
               cust.name as customer_name, cust.phone, cust.village_area,
               (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as collected
        FROM loans l
        JOIN customers cust ON l.customer_id = cust.id
        WHERE l.status = 'active' AND l.due_date < ?
      `;
      const dataRaw = await query.all(sql, [today]);
      const data = [];
      dataRaw.forEach(loan => {
        let payable = loan.amount;
        if (loan.interest_type === 'flat') {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100));
        } else {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100) * 12);
        }
        const collected = loan.collected || 0;
        const balance = payable - collected;
        if (balance > 0) {
          const days = Math.floor((new Date() - new Date(loan.due_date)) / (1000 * 60 * 60 * 24));
          data.push({ ...loan, balance, days });
        }
      });

      doc.fontSize(8).fillColor('#1A1A1A').text('Loan ID', 40, y, { bold: true });
      doc.text('Customer Name', 110, y, { bold: true });
      doc.text('Area', 220, y, { bold: true });
      doc.text('Due Date', 300, y, { bold: true });
      doc.text('Days Overdue', 380, y, { bold: true });
      doc.text('Amt Overdue', 460, y, { align: 'right', bold: true });

      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(40, y + 12).lineTo(doc.page.width - 40, y + 12).stroke();
      y += 20;

      data.forEach(item => {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 50;
        }
        doc.fontSize(8).fillColor('#444444').text(item.id, 40, y);
        doc.text(item.customer_name, 110, y);
        doc.text(item.village_area, 220, y);
        doc.text(item.due_date, 300, y);
        doc.fillColor('#EF4444').text(`${item.days} days`, 380, y);
        doc.text(`₹${item.balance.toFixed(2)}`, 400, y, { align: 'right' });
        y += 15;
      });
    } else if (type === 'outstanding') {
      const sql = `
        SELECT l.id, l.amount, l.interest_rate, l.interest_type, l.start_date, l.due_date,
               cust.name as customer_name, cust.phone,
               (SELECT SUM(amount_collected) FROM collections WHERE loan_id = l.id) as collected
        FROM loans l
        JOIN customers cust ON l.customer_id = cust.id
        WHERE l.status = 'active'
        ORDER BY l.due_date ASC
      `;
      const data = await query.all(sql);

      doc.fontSize(8).fillColor('#1A1A1A').text('Loan ID', 40, y, { bold: true });
      doc.text('Customer', 110, y, { bold: true });
      doc.text('Loan Amt', 220, y, { bold: true });
      doc.text('Total Pay', 290, y, { bold: true });
      doc.text('Collected', 360, y, { bold: true });
      doc.text('Outstanding', 460, y, { align: 'right', bold: true });

      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(40, y + 12).lineTo(doc.page.width - 40, y + 12).stroke();
      y += 20;

      data.forEach(item => {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 50;
        }
        const principal = item.amount;
        let payable = principal;
        if (item.interest_type === 'flat') {
          payable = principal + (principal * (item.interest_rate / 100));
        } else {
          payable = principal + (principal * (item.interest_rate / 100) * 12);
        }
        const collected = item.collected || 0;
        const outstanding = payable - collected;

        doc.fontSize(8).fillColor('#444444').text(item.id, 40, y);
        doc.text(item.customer_name, 110, y);
        doc.text(`₹${principal}`, 220, y);
        doc.text(`₹${payable}`, 290, y);
        doc.text(`₹${collected}`, 360, y);
        doc.fillColor('#EF4444').text(`₹${outstanding}`, 400, y, { align: 'right' });
        y += 15;
      });
    } else if (type === 'profit') {
      const collections = await query.get('SELECT SUM(amount_collected) as val FROM collections WHERE collected_date BETWEEN ? AND ?', [start_date || '2000-01-01', end_date || '2100-01-01']);
      const loans = await query.all('SELECT amount, processing_fee, interest_rate, interest_type, duration FROM loans WHERE start_date BETWEEN ? AND ?', [start_date || '2000-01-01', end_date || '2100-01-01']);
      
      let totalLent = 0;
      let totalProcessingFees = 0;
      let interestExpected = 0;

      loans.forEach(loan => {
        totalLent += loan.amount;
        totalProcessingFees += loan.processing_fee || 0;
        let payable = loan.amount;
        if (loan.interest_type === 'flat') {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100));
        } else {
          payable = loan.amount + (loan.amount * (loan.interest_rate / 100) * loan.duration);
        }
        interestExpected += (payable - loan.amount);
      });

      const netProfit = (collections.val || 0) + totalProcessingFees - totalLent;

      doc.fontSize(10).fillColor('#666666').text('Profitability Report Metrics', 40, y, { bold: true });
      y += 25;

      doc.fontSize(9).fillColor('#444444');
      doc.text(`Total Capital Disbursed (Lent):  ₹${totalLent.toLocaleString('en-IN')}`, 40, y);
      y += 18;
      doc.text(`Total Collections Recovered:  ₹${(collections.val || 0).toLocaleString('en-IN')}`, 40, y);
      y += 18;
      doc.text(`Processing Fees Collected:  ₹${totalProcessingFees.toLocaleString('en-IN')}`, 40, y);
      y += 18;
      doc.text(`Expected Interest Margin:  ₹${interestExpected.toLocaleString('en-IN')}`, 40, y);
      y += 25;

      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
      y += 15;

      doc.fontSize(12).fillColor('#10B981').text(`Net Cash Profit Margin:  ₹${netProfit.toLocaleString('en-IN')}`, 40, y, { bold: true });
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'PDF export failed' });
  }
});

export default router;
