import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/db.js';
import { authenticateToken, requireAdmin, logAudit } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fetch settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await query.all('SELECT * FROM settings');
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    res.json(settingsMap);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const settingsObj = req.body;
  try {
    for (const [key, value] of Object.entries(settingsObj)) {
      await query.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, String(value)]
      );
    }
    await logAudit(req.user.username, 'UPDATE_SETTINGS', 'Updated business settings');
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// View Audit Logs (Admin only)
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await query.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// Database Backup (Admin only)
router.post('/backup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dbSource = path.join(__dirname, '..', '..', 'database.sqlite');
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbDest = path.join(backupDir, `backup-${timestamp}.sqlite`);

    fs.copyFileSync(dbSource, dbDest);

    await logAudit(req.user.username, 'BACKUP_DB', `Database backed up to backups/backup-${timestamp}.sqlite`);
    res.json({ message: 'Backup created successfully', filename: `backup-${timestamp}.sqlite` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database backup failed' });
  }
});

// Database Restore (Admin only) - Lists and processes local database restores
router.post('/restore', authenticateToken, requireAdmin, async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Backup filename required' });
  }

  try {
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    const backupFile = path.join(backupDir, filename);

    if (!fs.existsSync(backupFile)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    const dbDest = path.join(__dirname, '..', '..', 'database.sqlite');
    
    // Copy file back (restore)
    fs.copyFileSync(backupFile, dbDest);

    await logAudit(req.user.username, 'RESTORE_DB', `Database restored from backups/${filename}`);
    res.json({ message: 'Database restored successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database restore failed' });
  }
});

// List available backups
router.get('/backups', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sqlite'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          size: stats.size,
          created_at: stats.mtime
        };
      })
      .sort((a, b) => b.created_at - a.created_at);

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

export default router;
