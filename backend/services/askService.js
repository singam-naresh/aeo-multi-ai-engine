import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.1-8b-instant';

// Injected into every system prompt — eliminates disclaimers and outdated hedging
const NO_DISCLAIMER_RULES = `
STRICT RULES — NO EXCEPTIONS:
- NEVER say "as of my knowledge cutoff", "I may be outdated", "prices may vary", or "I cannot access real-time data"
- NEVER mention past years unless the user explicitly asks about history
- Always assume CURRENT YEAR context (2025–2026)
- If exact latest data is unknown: give the MOST RELEVANT and REALISTIC current options based on market trends
- Prefer newer models, recent series, and active brands
- AVOID outdated models (Pixel 6a, Galaxy A54, iPhone 13, etc.)
- Be confident and direct — no hedging, no filler
`.trim();

// ── Intent Detection ──────────────────────────────────────────────────────────

export function detectIntent(query) {
  const q = query.toLowerCase().trim();

  if (
    q.startsWith('who') || q.startsWith('what') || q.startsWith('when') ||
    q.startsWith('where') || q.startsWith('how') || q.startsWith('why') ||
    q.startsWith('is ') || q.startsWith('are ') || q.startsWith('does ') ||
    q.startsWith('did ') || q.startsWith('was ') || q.startsWith('were ')
  ) return 'informational';

  if (
    q.includes('best') || q.includes('top') || q.includes('under') ||
    q.includes(' vs ') || q.includes('compare') || q.includes('recommend') ||
    q.includes('which') || q.includes('suggest')
  ) return 'recommendation';

  if (
    q.includes('seo') || q.includes('ranking') || q.includes('optimize') ||
    q.includes('strategy') || q.includes('aeo') || q.includes('visibility') ||
    q.includes('keyword') || q.includes('traffic')
  ) return 'strategy';

  return 'general';
}

// ── Prompt Builders ───────────────────────────────────────────────────────────

function buildPrompt(query, intent) {
  if (intent === 'informational' || intent === 'general') {
    return {
      system: `You are an expert assistant with up-to-date knowledge of the world.
Answer queries directly and factually. No marketing language. No templates. No generic filler.
${NO_DISCLAIMER_RULES}`,
      user: `Query: ${query}`,
    };
  }

  if (intent === 'recommendation') {
    return {
      system: `You are a product and market expert with current knowledge of available options.
For product queries: return the top 5 current options with a short reason per item. No fake pricing if unsure.
For service queries: return the top current platforms or services with brief reasoning.
${NO_DISCLAIMER_RULES}

FORMAT (for product/device queries):
1. [Product Name] — [one-line reason]
2. [Product Name] — [one-line reason]
...

Be specific. Use real current model names.`,
      user: `Query: ${query}`,
    };
  }

  if (intent === 'strategy') {
    return {
      system: `You are an AEO/SEO expert with current knowledge of search ranking factors.
Provide actionable strategy to improve ranking and visibility.
Give specific, concrete actions. No generic advice. Business-focused output only.
${NO_DISCLAIMER_RULES}`,
      user: `Query: ${query}`,
    };
  }

  // fallback
  return {
    system: `You are a helpful, accurate AI assistant with current knowledge.
Answer the query directly and concisely.
${NO_DISCLAIMER_RULES}`,
    user: `Query: ${query}`,
  };
}

// ── Core Ask Function ─────────────────────────────────────────────────────────

export async function askAI(query) {
  const intent = detectIntent(query);
  const { system, user } = buildPrompt(query, intent);

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
      temperature: 0.4,
      max_tokens:  1024,
    },
    {
      headers: {
        Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const answer = response.data.choices[0]?.message?.content?.trim() || '';

  return { answer, type: intent };
}
