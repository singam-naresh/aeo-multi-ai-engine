import jwt from 'jsonwebtoken';

const JWT_SECRET  = process.env.JWT_SECRET || 'aeo-engine-secret-change-in-production';
const JWT_EXPIRES = '7d';

/**
 * Generate a signed JWT for a user.
 * @param {{ id: number, email: string }} user
 * @returns {string}
 */
export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Express middleware — extracts and verifies a Bearer token.
 * If valid: attaches req.user = { id, email }
 * If missing or invalid: sets req.user = null and continues (guest mode).
 * Never blocks the request.
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (_) {
    req.user = null; // expired or invalid — treat as guest
  }
  next();
}

/**
 * Express middleware — requires a valid token.
 * Returns 401 if missing or invalid.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
