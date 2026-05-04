import { Router } from 'express';
import { analyzeWithMultipleModels } from '../services/aiService.js';

const router = Router();

// POST /api/analyze
router.post('/analyze', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'query is required and must be a non-empty string' });
  }

  try {
    const result = await analyzeWithMultipleModels(query.trim());
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Analysis error:', error.message);
    return res.status(500).json({ error: 'Failed to analyze query' });
  }
});

export default router;
