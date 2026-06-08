import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { authenticateToken, requireAdmin, logAudit } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sri_murugan_finance_secret_key_123';

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await query.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.is_disabled === 1) {
      return res.status(403).json({ error: 'Your account has been disabled. Please contact the administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '24h'
    });

    await logAudit(user.username, 'LOGIN', 'Logged into the system');

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user details
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// List all users (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await query.all('SELECT id, username, role, name, is_disabled, created_at FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// Toggle Disable user account (Admin only)
router.put('/users/:id/toggle-disable', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetUser = await query.get('SELECT username, is_disabled FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUser.username === req.user.username) {
      return res.status(400).json({ error: 'Cannot disable yourself' });
    }

    const newStatus = targetUser.is_disabled === 1 ? 0 : 1;
    await query.run('UPDATE users SET is_disabled = ? WHERE id = ?', [newStatus, req.params.id]);
    
    await logAudit(
      req.user.username,
      newStatus === 1 ? 'DISABLE_USER' : 'ENABLE_USER',
      `Changed user ${targetUser.username} status to ${newStatus === 1 ? 'disabled' : 'enabled'}`
    );

    res.json({ message: `User ${newStatus === 1 ? 'disabled' : 'enabled'} successfully`, is_disabled: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user account status' });
  }
});

// Register user (Admin only)
router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role, name } = req.body;
  if (!username || !password || !role || !name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!['super_admin', 'admin', 'family', 'staff', 'customer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Allowed roles are: super_admin, admin, family, staff, customer' });
  }

  try {
    const existing = await query.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await query.run(
      'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, name]
    );

    await logAudit(req.user.username, 'CREATE_USER', `Created user ${username} with role ${role}`);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Public customer signup route
router.post('/signup', async (req, res) => {
  const { name, phone, password, village_area, aadhaar, address } = req.body;
  if (!name || !phone || !password || !village_area) {
    return res.status(400).json({ error: 'Name, phone, password, and village/area are required' });
  }

  // Validate phone number
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
  }

  try {
    const existingUser = await query.get('SELECT * FROM users WHERE username = ?', [phone]);
    const existingCustomer = await query.get('SELECT * FROM customers WHERE phone = ?', [phone]);
    if (existingUser || existingCustomer) {
      return res.status(400).json({ error: 'A user or customer with this mobile number already exists.' });
    }

    // Generate custom customer ID (SMC-XXXX)
    const row = await query.get("SELECT id FROM customers ORDER BY id DESC LIMIT 1");
    let customerId = "SMC-0001";
    if (row) {
      const num = parseInt(row.id.split('-')[1]) + 1;
      customerId = `SMC-${num.toString().padStart(4, '0')}`;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert customer record
    await query.run(
      `INSERT INTO customers (id, name, phone, address, village_area, aadhaar, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [customerId, name, phone, address || '', village_area, aadhaar || '']
    );

    // Insert user record
    await query.run(
      'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
      [phone, hashedPassword, 'customer', name]
    );

    await logAudit(phone, 'SIGNUP_CUSTOMER', `Customer self-registered: ${phone} (${name})`);
    res.status(201).json({ message: 'Customer registered successfully', customerId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete customer registration' });
  }
});

// Delete user (Admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const targetUser = await query.get('SELECT username FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUser.username === req.user.username) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await query.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    await logAudit(req.user.username, 'DELETE_USER', `Deleted user ${targetUser.username}`);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset Password
router.post('/reset-password', authenticateToken, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }

  // Check permissions: admin can reset any password, standard user can only reset their own
  if (!['super_admin', 'admin', 'family'].includes(req.user.role) && req.user.id !== parseInt(userId)) {
    return res.status(403).json({ error: 'Unauthorized to reset password for this user' });
  }

  try {
    const targetUser = await query.get('SELECT username FROM users WHERE id = ?', [userId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);
    await logAudit(req.user.username, 'RESET_PASSWORD', `Reset password for user ${targetUser.username}`);

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
