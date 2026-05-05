import { Router } from 'express';
import { askAI } from '../services/askService.js';

const router = Router();

// POST /api/ask  — pure AI response engine, no strategy wrapping
router.post('/ask', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'query is required and must be a non-empty string' });
  }

  try {
    const result = await askAI(query.trim());
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Ask error:', error.message);
    return res.status(500).json({ error: 'Failed to process query' });
  }
});

export default router;
