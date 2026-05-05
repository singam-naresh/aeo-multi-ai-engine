import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.1-8b-instant';

// ── Shared no-disclaimer preamble ─────────────────────────────────────────────
const BASE_RULES = `
ABSOLUTE RULES — NO EXCEPTIONS:
- NEVER say "as of my knowledge cutoff", "I may be outdated", "prices may vary", or "I cannot access real-time data"
- NEVER mention past years unless the user explicitly asks about history
- Assume CURRENT YEAR context (2025–2026)
- Use CURRENT products and brands — avoid outdated models (Pixel 6a, Galaxy A54, iPhone 13, Redmi Note 10, etc.)
- Be confident and direct — no hedging, no filler, no disclaimers
`.trim();

// Generic phrases that degrade output quality — stripped before returning
const GENERIC_PHRASES = [
  /\bwell[- ]rounded option\b/gi,
  /\bstrong performance\b/gi,
  /\bgreat value for money\b/gi,
  /\bsolid choice\b/gi,
  /\bpopular choice\b/gi,
  /\bexcellent option\b/gi,
  /\bgood option\b/gi,
  /\bworth considering\b/gi,
  /\bknowledge cutoff\b/gi,
  /\btraining data\b/gi,
  /\bas of \d{4}\b/gi,
  /\bI cannot (access|provide|guarantee)\b/gi,
  /\bI (may|might) be (outdated|incorrect)\b/gi,
];

function stripGenericPhrases(text) {
  let t = text;
  for (const re of GENERIC_PHRASES) {
    t = t.replace(re, '');
  }
  return t.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Intent Detection ──────────────────────────────────────────────────────────

// Detect if the query is asking about future or uncertain timeframes
function isFutureQuery(query) {
  const q = query.toLowerCase();
  return /\b(2026|2027|2028|future|upcoming|next year|will be|going to be|expected|predicted|best in future)\b/.test(q);
}

export function detectIntent(query) {
  const q = query.toLowerCase().trim();

  // PRODUCT_QUERY — physical devices and consumer goods
  if (/\b(phones?|mobiles?|smartphones?|laptops?|notebooks?|tablets?|ipad|ac|air conditioner|tv|television|headphones?|earbuds?|earphones?|speakers?|smartwatches?|watches?|cameras?|gpu|cpu|processor|ssd|ram|router|printer|monitors?)\b/.test(q))
    return 'PRODUCT_QUERY';

  // PLATFORM_QUERY — digital services, SaaS, job sites, tools
  if (/\b(jobs?|careers?|resume|hiring|internship|platforms?|websites?|apps?|software|saas|tools?|services?|crm|dashboard|automation|chatbots?|ai tools?|generators?)\b/.test(q))
    return 'PLATFORM_QUERY';

  // INFORMATIONAL_QUERY — facts, people, places, history, how-to
  if (
    q.startsWith('who') || q.startsWith('what') || q.startsWith('when') ||
    q.startsWith('where') || q.startsWith('why') || q.startsWith('how') ||
    q.startsWith('is ') || q.startsWith('are ') || q.startsWith('does ') ||
    q.startsWith('did ') || q.startsWith('was ') || q.startsWith('were ') ||
    /\b(history|explain|define|meaning|difference between|vs)\b/.test(q)
  ) return 'INFORMATIONAL_QUERY';

  // Default — treat as informational
  return 'INFORMATIONAL_QUERY';
}

// ── Prompt Builders ───────────────────────────────────────────────────────────

function buildPrompt(query, intent) {
  // ── Future / uncertain timeframe queries ─────────────────────────────────
  // Never guess exact future products — frame as current best + market direction
  if (intent === 'PRODUCT_QUERY' && isFutureQuery(query)) {
    return {
      system: `You are a consumer technology analyst with current market knowledge.
${BASE_RULES}

SPECIAL RULE — FUTURE/UNCERTAIN QUERY:
- Use SERIES language: "Samsung Galaxy S24 series", "latest iPhone Pro models", "latest Pixel flagship"
- Do NOT invent specific future model names or specs
- Recommend the CURRENT best options in this category confidently
- Then describe the MARKET DIRECTION (trends, upcoming improvements)
- Be direct and practical — no over-explanation

OUTPUT FORMAT (use exactly this):
Top Picks (Current Best Options):
1. [Product / Series Name] — [why it leads today]
2. [Product / Series Name] — [why it leads today]
3. [Product / Series Name] — [why it leads today]

Market Direction:
- [trend 1]
- [trend 2]
- [trend 3]`,
      user: `Query: ${query}`,
    };
  }
  if (intent === 'PRODUCT_QUERY') {
    return {
      system: `You are a consumer technology expert with current market knowledge.
${BASE_RULES}

ADDITIONAL RULES FOR PRODUCT QUERIES:
- Use SERIES language, not specific outdated model numbers:
  ✅ "Samsung Galaxy S24 series" NOT "Samsung Galaxy S23"
  ✅ "latest iPhone Pro models" NOT "iPhone 14"
  ✅ "latest Pixel flagship" NOT "Pixel 7"
  ✅ "OnePlus latest flagship" NOT "OnePlus 11"
- Give TOP 3–5 CURRENT and RELEVANT items only
- Include a SPECIFIC reason per item (performance, camera, battery, value, etc.)
- NEVER mix categories (no games, apps, or services for hardware queries)
- Do NOT include fake pricing — omit price if unsure
- End with a short Market Direction section (3 bullet points max)

OUTPUT FORMAT (use exactly this):
Top Picks:
1. [Product / Series Name] — [specific reason]
2. [Product / Series Name] — [specific reason]
3. [Product / Series Name] — [specific reason]

Market Direction:
- [trend 1]
- [trend 2]
- [trend 3]`,
      user: `Query: ${query}`,
    };
  }

  if (intent === 'PLATFORM_QUERY') {
    return {
      system: `You are a digital platform and SaaS expert with current knowledge of the market.
${BASE_RULES}

ADDITIONAL RULES FOR PLATFORM QUERIES:
- Compare real, active platforms only (LinkedIn, Indeed, Notion, etc.)
- Give practical insights: UX quality, key features, trust signals, user base
- No physical product language (no "battery", "display", "RAM")
- Be specific about what makes each platform stand out

OUTPUT FORMAT (use exactly this):
Top Platforms:
1. [Platform Name] — [specific reason: UX, features, trust, use-case]
2. [Platform Name] — [specific reason]
3. [Platform Name] — [specific reason]

Best for: [1 line on which platform suits which user type]`,
      user: `Query: ${query}`,
    };
  }

  // INFORMATIONAL_QUERY
  return {
    system: `You are an expert assistant with accurate, current knowledge.
${BASE_RULES}

ADDITIONAL RULES FOR INFORMATIONAL QUERIES:
- Give a DIRECT, FACTUAL answer — no strategy language, no pricing, no positioning
- Keep it to 2–4 lines unless the topic genuinely requires more
- No bullet points unless listing multiple items
- No business jargon`,
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
      temperature: 0.35,
      max_tokens:  1024,
    },
    {
      headers: {
        Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const raw    = response.data.choices[0]?.message?.content?.trim() || '';
  const answer = stripGenericPhrases(raw);

  return { answer, type: intent };
}
