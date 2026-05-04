import { Router } from 'express';
import { analyzeWithMultipleModels } from '../services/aiService.js';
import { saveQuery, saveResult, logAnalytics } from '../db/database.js';

const router = Router();

// POST /api/analyze
router.post('/analyze', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'query is required and must be a non-empty string' });
  }

  try {
    const result = await analyzeWithMultipleModels(query.trim());

    // Send response immediately — DB writes happen after
    res.status(200).json({ success: true, data: result });

    // ── Non-blocking sidecar: persist to DB ──────────────────────────────
    setImmediate(() => {
      const bestModel  = result.comparison?.bestModel ?? null;
      const confidence = result.finalStrategy?.confidence ?? null;
      const intent     = result.finalStrategy?.groundSignals?.[0] ?? null;

      saveQuery(query.trim());
      saveResult(query.trim(), bestModel, confidence);
      logAnalytics(query.trim(), intent, bestModel);
    });
  } catch (error) {
    console.error('Analysis error:', error.message);
    return res.status(500).json({ error: 'Failed to analyze query' });
  }
});

export default router;
