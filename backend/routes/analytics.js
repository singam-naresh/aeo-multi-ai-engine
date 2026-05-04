import { Router } from 'express';
import { getAnalytics } from '../db/database.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/analytics  (scoped to user if logged in, global otherwise)
router.get('/analytics', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const data   = getAnalytics(userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Analytics error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
