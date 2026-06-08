import express from 'express';
import multer from 'multer';
import { query } from '../config/db.js';
import { authenticateToken, logAudit } from '../middleware/auth.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

const router = express.Router();

// Configure multer for memory uploads
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const cpUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'aadhaar_front', maxCount: 1 },
  { name: 'aadhaar_back', maxCount: 1 },
  { name: 'other_doc', maxCount: 1 }
]);

// Helper to generate custom Customer ID (e.g. SMC-0001)
const generateCustomerId = async () => {
  const row = await query.get("SELECT id FROM customers ORDER BY id DESC LIMIT 1");
  if (!row) return "SMC-0001";
  const num = parseInt(row.id.split('-')[1]) + 1;
  return `SMC-${num.toString().padStart(4, '0')}`;
};

// Add Customer
router.post('/', authenticateToken, cpUpload, async (req, res) => {
  const { name, phone, alt_phone, address, village_area, aadhaar, pan, occupation, guarantor_name, guarantor_phone, guarantor_relation } = req.body;
  
  if (!name || !phone || !village_area) {
    return res.status(400).json({ error: 'Name, phone, and village/area are required' });
  }

  try {
    // Validate phone pattern
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
    }

    // Validate duplicate phone or Aadhaar (only check Aadhaar if provided)
    let duplicate;
    if (aadhaar && aadhaar.trim() !== '') {
      duplicate = await query.get(
        'SELECT id FROM customers WHERE phone = ? OR (aadhaar IS NOT NULL AND aadhaar != "" AND aadhaar = ?)',
        [phone, aadhaar.trim()]
      );
    } else {
      duplicate = await query.get('SELECT id FROM customers WHERE phone = ?', [phone]);
    }

    if (duplicate) {
      return res.status(400).json({ error: 'A customer with this phone number or Aadhaar already exists.' });
    }

    const customerId = await generateCustomerId();

    // Stream uploads to Cloudinary
    let photo_url = null;
    let aadhaar_front_url = null;
    let aadhaar_back_url = null;
    let other_doc_url = null;

    if (req.files) {
      if (req.files['photo']) photo_url = await uploadToCloudinary(req.files['photo'][0].buffer, 'customers/photos');
      if (req.files['aadhaar_front']) aadhaar_front_url = await uploadToCloudinary(req.files['aadhaar_front'][0].buffer, 'customers/aadhaar');
      if (req.files['aadhaar_back']) aadhaar_back_url = await uploadToCloudinary(req.files['aadhaar_back'][0].buffer, 'customers/aadhaar');
      if (req.files['other_doc']) other_doc_url = await uploadToCloudinary(req.files['other_doc'][0].buffer, 'customers/agreements');
    }

    await query.run(
      `INSERT INTO customers (id, name, phone, alt_phone, address, village_area, aadhaar, pan, occupation, guarantor_name, guarantor_phone, guarantor_relation, photo_url, aadhaar_front_url, aadhaar_back_url, other_doc_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId, name, phone, alt_phone || null, address || '', village_area, aadhaar || '', pan || null, occupation || null,
        guarantor_name || null, guarantor_phone || null, guarantor_relation || null,
        photo_url, aadhaar_front_url, aadhaar_back_url, other_doc_url
      ]
    );

    await logAudit(req.user.username, 'CREATE_CUSTOMER', `Created customer ${name} (${customerId})`, req);
    res.status(201).json({ message: 'Customer created successfully', id: customerId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

import bcrypt from 'bcryptjs';

// List / Search Customers
router.get('/', authenticateToken, async (req, res) => {
  const { search, area, include_inactive } = req.query;
  const isCustomer = req.user.role === 'customer';
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  if (isCustomer) {
    sql += ' AND phone = ?';
    params.push(req.user.username);
  } else {
    if (include_inactive !== '1') {
      sql += ' AND is_active = 1';
    }

    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR id LIKE ? OR aadhaar LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (area) {
      sql += ' AND village_area = ?';
      params.push(area);
    }
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const customers = await query.all(sql, params);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get Customer Profile (with loans and summaries)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await query.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (req.user.role === 'customer' && customer.phone !== req.user.username) {
      return res.status(403).json({ error: 'Access denied to this customer profile' });
    }

    const loans = await query.all('SELECT * FROM loans WHERE customer_id = ? ORDER BY start_date DESC', [req.params.id]);
    
    // Fetch collections for customer
    const collections = await query.all(
      `SELECT c.*, l.amount as loan_amount, l.interest_rate 
       FROM collections c 
       JOIN loans l ON c.loan_id = l.id 
       WHERE c.customer_id = ? 
       ORDER BY c.collected_date DESC`,
      [req.params.id]
    );

    res.json({ customer, loans, collections });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Update Customer
router.put('/:id', authenticateToken, cpUpload, async (req, res) => {
  const { name, phone, alt_phone, address, village_area, aadhaar, pan, occupation, guarantor_name, guarantor_phone, guarantor_relation } = req.body;
  
  if (!name || !phone || !village_area) {
    return res.status(400).json({ error: 'Name, phone, and village/area are required' });
  }

  try {
    const existing = await query.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Validate phone pattern
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
    }

    let photo_url = existing.photo_url;
    let aadhaar_front_url = existing.aadhaar_front_url;
    let aadhaar_back_url = existing.aadhaar_back_url;
    let other_doc_url = existing.other_doc_url;

    if (req.files) {
      if (req.files['photo']) photo_url = await uploadToCloudinary(req.files['photo'][0].buffer, 'customers/photos');
      if (req.files['aadhaar_front']) aadhaar_front_url = await uploadToCloudinary(req.files['aadhaar_front'][0].buffer, 'customers/aadhaar');
      if (req.files['aadhaar_back']) aadhaar_back_url = await uploadToCloudinary(req.files['aadhaar_back'][0].buffer, 'customers/aadhaar');
      if (req.files['other_doc']) other_doc_url = await uploadToCloudinary(req.files['other_doc'][0].buffer, 'customers/agreements');
    }

    await query.run(
      `UPDATE customers SET 
         name = ?, phone = ?, alt_phone = ?, address = ?, village_area = ?, aadhaar = ?, pan = ?, occupation = ?, 
         guarantor_name = ?, guarantor_phone = ?, guarantor_relation = ?, 
         photo_url = ?, aadhaar_front_url = ?, aadhaar_back_url = ?, other_doc_url = ?
       WHERE id = ?`,
      [
        name, phone, alt_phone || null, address || '', village_area, aadhaar || '', pan || null, occupation || null,
        guarantor_name || null, guarantor_phone || null, guarantor_relation || null,
        photo_url, aadhaar_front_url, aadhaar_back_url, other_doc_url,
        req.params.id
      ]
    );

    await logAudit(req.user.username, 'UPDATE_CUSTOMER', `Updated customer ${name} (${req.params.id})`, req);
    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Soft Delete Customer (Admin only, requires password check)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { adminPassword, reason } = req.body;

  if (!['super_admin', 'admin', 'family'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only administrators can delete customers' });
  }

  if (!adminPassword || !reason) {
    return res.status(400).json({ error: 'Admin password and deletion reason are required' });
  }

  try {
    const customer = await query.get('SELECT name FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Verify Admin Password
    const adminUser = await query.get('SELECT password_hash FROM users WHERE username = ?', [req.user.username]);
    const isMatch = await bcrypt.compare(adminPassword, adminUser.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    // Set Active = 0 (Soft Delete)
    await query.run('UPDATE customers SET is_active = 0 WHERE id = ?', [req.params.id]);
    
    // Log Audit
    await logAudit(
      req.user.username,
      'DELETE_CUSTOMER',
      `Soft deleted customer ${customer.name} (${req.params.id}). Reason: ${reason}`
    );

    res.json({ message: 'Customer soft-deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Restore Customer (Admin only)
router.post('/:id/restore', authenticateToken, async (req, res) => {
  if (!['super_admin', 'admin', 'family'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only administrators can restore customers' });
  }

  try {
    const customer = await query.get('SELECT name FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await query.run('UPDATE customers SET is_active = 1 WHERE id = ?', [req.params.id]);
    
    await logAudit(
      req.user.username,
      'RESTORE_CUSTOMER',
      `Restored customer ${customer.name} (${req.params.id})`
    );

    res.json({ message: 'Customer restored successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to restore customer' });
  }
});

export default router;
