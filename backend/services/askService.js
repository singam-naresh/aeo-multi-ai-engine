import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.1-8b-instant';

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
      system: 'You are a highly accurate AI assistant. Answer queries using real-world, up-to-date knowledge. Be direct and factual. No marketing language. No templates. No generic filler.',
      user:   `Query: ${query}`,
    };
  }

  if (intent === 'recommendation') {
    return {
      system: 'You are a product and service expert. Give real-world, current recommendations. List the best options available now. Avoid outdated products. Explain briefly why each is recommended. Keep it practical and realistic.',
      user:   `Query: ${query}`,
    };
  }

  if (intent === 'strategy') {
    return {
      system: 'You are an AEO/SEO expert. Provide actionable strategy to improve ranking and visibility. Give specific actions. No generic advice. Business-focused output only.',
      user:   `Query: ${query}`,
    };
  }

  // fallback
  return {
    system: 'You are a helpful, accurate AI assistant. Answer the query directly and concisely.',
    user:   `Query: ${query}`,
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
      temperature: 0.5,
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
