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
    // Never return 500 — frontend shows "Analysis failed" for the whole page on 500
    return res.status(200).json({
      success: true,
      data: {
        answer: 'I was unable to process that query right now. Please try again in a moment.',
        structured: null,
        type: 'INFORMATIONAL_QUERY',
      },
    });
  }
});

export default router;
