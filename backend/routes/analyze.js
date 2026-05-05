import { Router } from 'express';
import { analyzeWithMultipleModels } from '../services/aiService.js';
import { saveQuery, saveResult, logAnalytics } from '../db/database.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Safe fallback returned when the pipeline throws — keeps frontend stable
const FALLBACK_RESPONSE = {
  groq:   { ranking: [], competitors: [], insights: '', suggestions: [], visibilityScore: 70, improvementPotential: 'Medium' },
  gpt:    { ranking: [], competitors: [], insights: '', suggestions: [], visibilityScore: 70, improvementPotential: 'Medium' },
  gemini: { ranking: [], competitors: [], insights: '', suggestions: [], visibilityScore: 70, improvementPotential: 'Medium' },
  comparison: { bestModel: 'groq', reason: 'Fallback mode — AI temporarily unavailable.' },
  finalStrategy: {
    recommendedAction: 'AI temporarily unavailable. Please try again in a moment.',
    positioning:       'System fallback mode — no strategy generated.',
    priceStrategy:     '',
    quickWin:          '',
    focusKeywords:     [],
    confidence:        0.5,
    evidence:          '',
    groundSignals:     [],
  },
};

// POST /api/analyze  (auth optional — works for guests too)
router.post('/analyze', optionalAuth, async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'query is required and must be a non-empty string' });
  }

  try {
    const result = await analyzeWithMultipleModels(query.trim());

    // Send response immediately — DB writes happen after
    res.status(200).json({ success: true, data: result });

    // ── Non-blocking sidecar: persist to DB (with optional user_id) ──────
    setImmediate(() => {
      const userId     = req.user?.id ?? null;
      const bestModel  = result.comparison?.bestModel ?? null;
      const confidence = result.finalStrategy?.confidence ?? null;
      const intent     = result.finalStrategy?.groundSignals?.[0] ?? null;

      saveQuery(query.trim(), userId);
      saveResult(query.trim(), bestModel, confidence, userId);
      logAnalytics(query.trim(), intent, bestModel, userId);
    });
  } catch (error) {
    // Return 200 with fallback so the frontend never crashes
    console.error('Analyze failed:', error.message);
    return res.status(200).json({ success: true, data: FALLBACK_RESPONSE });
  }
});

export default router;
