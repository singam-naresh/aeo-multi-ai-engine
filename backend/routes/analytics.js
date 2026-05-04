import { Router } from 'express';
import { getAnalytics } from '../db/database.js';

const router = Router();

// GET /api/analytics
router.get('/analytics', (req, res) => {
  try {
    const data = getAnalytics();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Analytics error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
