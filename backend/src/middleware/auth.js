import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sri_murugan_finance_secret_key_123';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Fallback to query parameter for browser window.open downloads
  if (!token && req.query.authorization) {
    const queryAuth = req.query.authorization;
    token = queryAuth.startsWith('Bearer ') ? queryAuth.split(' ')[1] : queryAuth;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, tokenUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      const user = await query.get('SELECT id, username, role, name FROM users WHERE id = ?', [tokenUser.id]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      req.user = user;
      next();
    } catch (dbErr) {
      return res.status(500).json({ error: 'Database error authentication' });
    }
  });
};

export const requireAdmin = (req, res, next) => {
  if (req.user && ['super_admin', 'admin', 'family'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ error: 'Admin role required' });
  }
};

export const requireStaffOrAdmin = (req, res, next) => {
  if (req.user && ['super_admin', 'admin', 'family', 'staff'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ error: 'Staff or Admin privilege required' });
  }
};

export const logAudit = async (username, action, details, req = null) => {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : 'SYSTEM';
    const device = req ? (req.headers['user-agent'] || '') : 'SYSTEM';

    await query.run(
      'INSERT INTO audit_logs (username, action, details, ip_address, device_info) VALUES (?, ?, ?, ?, ?)',
      [username, action, details, String(ip), String(device)]
    );
  } catch (err) {
    console.error('Audit logger failed:', err);
  }
};
