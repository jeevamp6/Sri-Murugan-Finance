import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import loanRoutes from './routes/loans.js';
import collectionRoutes from './routes/collections.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';

import { apiLimiter, authLimiter, helmetSecurity, xssSanitizer } from './middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmetSecurity);
app.use(apiLimiter);

// Configure CORS for Production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://srimuruganfinance.in',
  'https://sri-murugan-finance.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(xssSanitizer);

// Rate limiter override on login routes
app.use('/api/auth/login', authLimiter);

// Serve uploaded documents statically
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Attach API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Root Healthcheck
app.get('/', (req, res) => {
  res.json({ message: 'Sri Murugan Finance API Server is running.' });
});

app.listen(PORT, () => {
  console.log(`Server started successfully on port ${PORT}`);
});
