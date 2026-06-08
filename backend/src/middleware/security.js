import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Rate Limiting: max 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limiter for Login endpoints: max 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes' }
});

// Configure Helmet security headers
export const helmetSecurity = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "*"]
    }
  },
  crossOriginEmbedderPolicy: false
});

// Basic XSS Sanitize middleware to strip tags
const cleanString = (val) => {
  if (typeof val !== 'string') return val;
  return val.replace(/<[^>]*>/g, '').trim();
};

export const xssSanitizer = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = cleanString(req.body[key]);
      } else if (typeof req.body[key] === 'object' && req.body[key] !== null) {
        // Simple recursive clean for nested objects
        for (const subKey in req.body[key]) {
          if (typeof req.body[key][subKey] === 'string') {
            req.body[key][subKey] = cleanString(req.body[key][subKey]);
          }
        }
      }
    }
  }
  next();
};
