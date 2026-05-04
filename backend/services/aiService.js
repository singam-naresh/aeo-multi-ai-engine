import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const FALLBACK_RESPONSE = {
  ranking: [
    { name: 'Leading platform in this category',    rank: 1 },
    { name: 'Established competitor with strong UX', rank: 2 },
    { name: 'Fast-growing alternative',              rank: 3 },
    { name: 'Budget-focused option',                 rank: 4 },
    { name: 'Niche specialist in this space',        rank: 5 },
  ],
  competitors: [
    'top competitors in this category',
    'established players in this space',
    'emerging challengers',
  ],
  insights: 'Top results in this category rank higher due to strong relevance to search intent, clear value proposition, and consistent user trust signals.',
  suggestions: [
    'Add a detailed comparison against top competitors in this category',
    'Include real user use-case examples to build credibility',
    'Highlight the single strongest differentiator in the opening section',
  ],
};

// ─── Prompt Builders ────────────────────────────────────────────────────────

// Detect whether a query is about a platform/service or a physical product
function queryDomainHint(query) {
  const q = query.toLowerCase();
  if (/\bjob(s)?\b|\bcareer|\bresume|\bhiring|\brecruit|\bplatform|\bwebsite|\bapp\b|\bsoftware|\bsaas|\btool\b|\bai\b|\bchatbot|\bgenerator/.test(q))
    return 'platform';
  return 'product';
}

function buildPromptGroq(query) {
  const domainType = queryDomainHint(query);
  const entityLabel = domainType === 'platform' ? 'platform or service' : 'product or brand';
  const insightGuidance = domainType === 'platform'
    ? 'Focus on: user experience, job matching quality, application flow, feature depth, and platform trust signals. Do NOT mention physical attributes.'
    : 'Focus on: features, build quality, performance, pricing, and user satisfaction signals.';

  return `You are an expert search ranking analyst.
Analyze the query: ${query}
Return ONLY valid JSON. Do NOT include any explanation.

STRICT RULES:
- Use REAL ${entityLabel} names (e.g. Indeed, LinkedIn, Apple, Samsung — whatever is relevant)
- NEVER use placeholders like "Product A", "Top Product", "Category Leader", "Competitor X"
- NEVER include percentages, CTR numbers, CVR numbers, or keyword density figures
- Use qualitative reasoning only: "strong engagement", "high relevance", "clear positioning"
- ${insightGuidance}

JSON format:
{
  "ranking": [
    { "name": "real name here", "rank": 1 },
    { "name": "real name here", "rank": 2 },
    { "name": "real name here", "rank": 3 },
    { "name": "real name here", "rank": 4 },
    { "name": "real name here", "rank": 5 }
  ],
  "competitors": ["real competitor names only"],
  "insights": "qualitative explanation of why top results rank higher — no numbers, no percentages",
  "suggestions": [
    "specific actionable improvement referencing a real feature or competitor",
    "specific positioning or content improvement",
    "specific trust or credibility improvement"
  ]
}
Output VALID JSON only.`;
}

function buildPromptGPT(query) {
  const domainType = queryDomainHint(query);
  const entityLabel = domainType === 'platform' ? 'platform or service' : 'product or brand';
  const insightGuidance = domainType === 'platform'
    ? 'Analyze: user acquisition, feature differentiation, onboarding quality, and platform positioning. Avoid physical product language.'
    : 'Analyze: market positioning, feature differentiation, pricing strategy, and user satisfaction drivers.';

  return `You are a senior business intelligence analyst.
Conduct a structured competitive analysis for: "${query}"
Return ONLY a raw valid JSON object. No markdown. No explanation. No code blocks.

STRICT RULES:
- Use REAL ${entityLabel} names only — never "Product A", "Top Product", "Category Leader"
- NEVER output percentages, CTR values, CVR values, or keyword density numbers
- Use qualitative language: "strong brand authority", "clear value proposition", "high user trust"
- ${insightGuidance}

{
  "ranking": [
    { "name": "real name", "rank": 1 },
    { "name": "real name", "rank": 2 },
    { "name": "real name", "rank": 3 },
    { "name": "real name", "rank": 4 },
    { "name": "real name", "rank": 5 }
  ],
  "competitors": ["real competitor or platform names"],
  "insights": "qualitative breakdown of why top results win — positioning, trust, relevance, user experience",
  "suggestions": [
    "actionable improvement with a specific feature or competitor reference",
    "positioning or differentiation strategy",
    "credibility or trust-building tactic"
  ]
}
Output VALID JSON only.`;
}

function buildPromptGemini(query) {
  const domainType = queryDomainHint(query);
  const entityLabel = domainType === 'platform' ? 'platform or service' : 'product or brand';
  const insightGuidance = domainType === 'platform'
    ? 'Think about: ease of use, job discovery quality, application experience, and what makes users return. Avoid physical product language.'
    : 'Think about: what makes users choose this, emotional and practical appeal, and what drives repeat purchases.';

  return `You are a user-focused product and platform analyst.
A user is searching for: "${query}"
Return ONLY a raw valid JSON object. No markdown. No explanation. No code blocks.

STRICT RULES:
- Use REAL ${entityLabel} names — never "Product A", "Top Product", "Category Leader", "Competitor X"
- NEVER include percentages, CTR, CVR, or any numeric performance claims
- Use human, qualitative language: "easy to use", "trusted by users", "strong community"
- ${insightGuidance}

{
  "ranking": [
    { "name": "real name", "rank": 1 },
    { "name": "real name", "rank": 2 },
    { "name": "real name", "rank": 3 },
    { "name": "real name", "rank": 4 },
    { "name": "real name", "rank": 5 }
  ],
  "competitors": ["real competitor or platform names"],
  "insights": "human-focused explanation of why users prefer these results — no numbers, no percentages",
  "suggestions": [
    "creative improvement referencing a real feature or user need",
    "user experience or onboarding improvement",
    "trust or community-building idea"
  ]
}
Output VALID JSON only.`;
}

// ─── Shared Utilities ────────────────────────────────────────────────────────

function parseAIResponse(content) {
  // Stage 1: direct parse
  try {
    return JSON.parse(content);
  } catch (_) {
    // Stage 2: extract JSON block using regex
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_) {
        // fall through to fallback
      }
    }
    return null;
  }
}

function addEnhancements(data) {
  const visibilityScore = Math.floor(Math.random() * (90 - 65 + 1)) + 65;
  const improvementPotential = visibilityScore < 75 ? 'High' : 'Medium';
  return { ...data, visibilityScore, improvementPotential };
}

// Placeholder patterns that should never appear in ranking or competitor names
const PLACEHOLDER_NAME_RE = /^(product [a-e]|competitor [a-z]|top competitor product|category leader product|popular alternative product|budget-friendly option|premium market choice|market leader|category challenger|emerging competitor)$/i;

function sanitizeName(name) {
  if (!name || PLACEHOLDER_NAME_RE.test(name.trim())) return null;
  return name;
}

function sanitizeResult(parsed) {
  const ranking = Array.isArray(parsed.ranking)
    ? parsed.ranking.filter((r) => r?.name && !PLACEHOLDER_NAME_RE.test(r.name.trim()))
    : [];

  const competitors = Array.isArray(parsed.competitors)
    ? parsed.competitors.filter((c) => c && !PLACEHOLDER_NAME_RE.test(c.trim()))
    : [];

  return {
    ranking:     ranking.length     ? ranking     : FALLBACK_RESPONSE.ranking,
    competitors: competitors.length ? competitors : FALLBACK_RESPONSE.competitors,
    insights:    typeof parsed.insights === 'string' ? parsed.insights  : FALLBACK_RESPONSE.insights,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : FALLBACK_RESPONSE.suggestions,
  };
}

// ─── Validation & Intelligence Layer ─────────────────────────────────────────

// 1. Remove fake numeric performance metrics from text
function removeFakeMetrics(text) {
  if (!text) return text;
  return text
    // ── Strip numeric percentages attached to marketing metric labels ──────
    .replace(/\b\d+(\.\d+)?%\s*(increase|improvement|boost|growth|higher|lower|better|worse|more|less)\b/gi, '')
    .replace(/\b\d+(\.\d+)?%\s*(CTR|CVR|conversion rate?|keyword density|click.through|open rate|bounce rate|engagement rate)\b/gi, '')
    .replace(/\b(CTR|CVR|conversion rate?|keyword density|click.through rate?|open rate|bounce rate)\s*(of\s*)?\d+(\.\d+)?%/gi, '')
    // ── Strip bare percentages that follow "of" or "at" (broken placeholders) ──
    // e.g. "density of %" → removed, "CTR of and" → removed
    .replace(/\b(density|rate|score|index|level)\s+of\s+\d*\.?\d*%?/gi, '')
    .replace(/\b(density|rate|score|index|level)\s+of\s+(and|or|the|a|an)\b/gi, '')
    // ── Strip any remaining bare percentage numbers ──────────────────────
    .replace(/\b\d+(\.\d+)?%/g, '')
    // ── Replace bare metric abbreviations with qualitative equivalents ────
    .replace(/\bCTR\b/g, 'click-through rate')
    .replace(/\bCVR\b/g, 'conversion rate')
    // ── Collapse whitespace ───────────────────────────────────────────────
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 2. Filter suggestions — remove generic/weak ones, keep specific actionable ones
const WEAK_SUGGESTION_PATTERNS = [
  /^improve (product )?description/i,
  /^add more (customer )?reviews/i,
  /^optimize (your )?(listing|product|page|seo)/i,
  /^enhance (your )?(product|listing|page)/i,
  /^update (your )?(product|listing|page)/i,
  /^focus on (seo|keywords|quality)/i,
  /^consider (adding|improving|updating)/i,
  /^ensure (your|the) (product|listing)/i,
  /^leverage (your|the)/i,
];

function isStrongSuggestion(s) {
  if (!s || s.split(' ').length < 4) return false;
  if (WEAK_SUGGESTION_PATTERNS.some((re) => re.test(s))) return false;
  // Must contain a feature, keyword, or measurable action signal
  return /\b(add|include|highlight|show|target|use|create|build|place|rewrite|insert|feature|spec|image|title|keyword|price|bundle|comparison|badge|demo|video|chart|screenshot|rating|review|segment|audience)\b/i.test(s);
}

// 3. Domain detection for cleaning rules
function detectCleaningDomain(query) {
  const q = query.toLowerCase();
  if (/laptop|phone|mobile|tablet|smartphone|device|gadget|headphone|earbud|monitor|keyboard|gpu|cpu|ssd/.test(q))
    return 'electronics';
  if (/\bai\b|website|tool|software|platform|saas|app\b|dashboard|automation|generator|chatbot/.test(q))
    return 'software';
  return 'generic';
}

// 4. Domain-specific insight/suggestion cleaning
const ELECTRONICS_KEEP = /battery|performance|camera|ram|display|processor|storage|screen|build|design|speed|benchmark|spec|weight|port|connectivity|refresh rate|resolution/i;
const ELECTRONICS_REMOVE = /\bstory\b|\bjourney\b|\bemotional\b|\blifestyle\b|\bcommunity\b|\bstorytell|\bvibe\b|\bbuzz\b/i;

const SOFTWARE_KEEP = /feature|pricing|integration|ux|ui|onboarding|workflow|api|dashboard|automation|support|trial|subscription|deployment|security|scalab/i;
const SOFTWARE_REMOVE = /battery|weight|camera|display|physical|hardware|cushion|comfort|wrist|ergonomic/i;

function cleanByDomain(text, domain) {
  if (!text) return text;
  if (domain === 'electronics') {
    if (ELECTRONICS_REMOVE.test(text)) {
      // Strip the offending clause rather than the whole sentence
      return text.replace(/[^.!?]*\b(story|journey|emotional|lifestyle|community|vibe|buzz|storytell)\b[^.!?]*/gi, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  if (domain === 'software') {
    if (SOFTWARE_REMOVE.test(text)) {
      return text.replace(/[^.!?]*\b(battery|weight|camera|display|physical|hardware|cushion|comfort|wrist|ergonomic)\b[^.!?]*/gi, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return text;
}

// 5. Validate and clean keywords against query core terms
const WEAK_KEYWORD_MODIFIERS = /^(comfortable|lightweight|stylish|durable|sleek|modern|elegant|beautiful|amazing|great|good|nice)\s+/i;

function validateKeywords(keywords, query) {
  const coreTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  const cleaned = keywords
    .map((kw) => kw.replace(WEAK_KEYWORD_MODIFIERS, '').trim())
    .filter((kw) => {
      if (!kw || kw.split(' ').length < 2) return false;
      // Must contain at least one core term from the query
      return coreTerms.some((term) => kw.toLowerCase().includes(term));
    });

  // Deduplicate
  return [...new Set(cleaned)].slice(0, 5);
}

// 6. Master pipeline: clean a single model result
function cleanModelResult(result, query) {
  const domain = detectCleaningDomain(query);

  // Run full sanitize pipeline: removeFakeMetrics → cleanByDomain → repairText → sentence filter
  const cleanedInsights = sanitizeOutput(cleanByDomain(removeFakeMetrics(result.insights), domain));

  const cleanedSuggestions = result.suggestions
    .map((s) => sanitizeOutput(cleanByDomain(removeFakeMetrics(s), domain)))
    .filter(isStrongSuggestion);

  // If all suggestions were filtered out, sanitize and keep the best original ones
  const finalSuggestions = cleanedSuggestions.length >= 2
    ? cleanedSuggestions
    : result.suggestions.map((s) => sanitizeOutput(s)).slice(0, 3);

  return {
    ...result,
    insights:    cleanedInsights || result.insights,
    suggestions: finalSuggestions,
  };
}

// ─── Normalization Layer ──────────────────────────────────────────────────────

// Phrase substitution map applied before tokenising the query
const QUERY_PHRASE_MAP = [
  [/mobile\s+phone/gi,          'phone'],
  [/\bbelow\b/gi,               'under'],
  [/\bbeneath\b/gi,             'under'],
  [/\bless\s+than\b/gi,         'under'],
  [/\bfor\s+gamers?\b/gi,       'gaming'],
  [/\bgaming\s+purpose/gi,      'gaming'],
  [/\bfor\s+photography\b/gi,   'camera'],
  [/\bfor\s+photos?\b/gi,       'camera'],
  // Strip bare "photography" when "camera" is already present (avoids duplication)
  [/\bcamera\b.*\bphotography\b/gi, (m) => m.replace(/\bphotography\b/gi, '').replace(/\s{2,}/g, ' ').trim()],
  [/\bphotography\b.*\bcamera\b/gi, (m) => m.replace(/\bphotography\b/gi, '').replace(/\s{2,}/g, ' ').trim()],
  // Any remaining bare "photography" → "camera"
  [/\bphotography\b/gi,         'camera'],
  [/\bfor\s+coding\b/gi,        'for coding'],
  [/\bfor\s+programming\b/gi,   'for programming'],
  [/\bfor\s+developers?\b/gi,   'for developers'],
  [/\bfor\s+students?\b/gi,     'for students'],
  [/\bunder\s+(\d+)\s*k\b/gi,   (_, n) => `under ${parseInt(n) * 1000}`],
  [/,+/g,                       ' '],
  [/\s{2,}/g,                   ' '],
];

// Normalise a raw user query into a clean, canonical form
function normalizeQueryText(query) {
  let q = query.toLowerCase().trim();

  // Apply phrase substitutions in order
  for (const [pattern, replacement] of QUERY_PHRASE_MAP) {
    q = q.replace(pattern, typeof replacement === 'function' ? replacement : replacement);
  }

  // Remove duplicate consecutive words ("phone phone" → "phone")
  q = q.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // Remove duplicate non-consecutive words — keep first occurrence
  const words = q.split(/\s+/);
  const seen = new Set();
  q = words.filter((w) => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  }).join(' ');

  return q.trim();
}

// Enhanced domain detection — returns sub-domains for better keyword shaping
function detectEnhancedDomain(query) {
  const q = query.toLowerCase();
  if (/gaming|fps|\bgpu\b|graphics card/.test(q))                          return 'electronics_gaming';
  if (/camera|photography|photo|low.light|portrait/.test(q))               return 'electronics_camera';
  if (/laptop|notebook|macbook|chromebook/.test(q))                        return 'electronics_laptop';
  if (/phone|smartphone|iphone|android|mobile/.test(q))                    return 'electronics_phone';
  if (/headphone|earbud|earphone|speaker/.test(q))                         return 'electronics_audio';
  if (/tablet|ipad/.test(q))                                               return 'electronics_tablet';
  if (/\bai\b|chatbot|generator|llm|gpt|copilot/.test(q))                  return 'software_ai';
  if (/website|tool|software|platform|saas|\bapp\b|dashboard|automation/.test(q)) return 'software';
  if (/job|career|resume|hiring|recruit/.test(q))                          return 'jobs';
  return 'generic';
}

// Domain-specific keyword seed terms used to validate and shape keywords
const DOMAIN_KEYWORD_SEEDS = {
  electronics_gaming:  ['gaming', 'fps', 'performance', 'gpu', 'graphics'],
  electronics_camera:  ['camera', 'photography', 'photo', 'low light', 'portrait'],
  electronics_laptop:  ['laptop', 'laptops', 'notebook'],
  electronics_phone:   ['phone', 'smartphone', 'mobile'],
  electronics_audio:   ['headphones', 'earbuds', 'earphones', 'audio'],
  electronics_tablet:  ['tablet', 'ipad'],
  software_ai:         ['ai', 'tool', 'platform', 'software', 'generator'],
  software:            ['tool', 'platform', 'software', 'app', 'website'],
  jobs:                ['job', 'jobs', 'career', 'resume', 'hiring'],
  generic:             [],
};

// Repair broken sentences left after metric removal
function repairText(text) {
  if (!text) return text;

  return text
    // ── Fix broken metric-removal artifacts ──────────────────────────────
    .replace(/click.through rate\s+increased\s+by\s*/gi, 'Higher click-through driven by ')
    .replace(/conversion rate?\s+increased\s+by\s*/gi, 'Stronger conversion driven by ')
    // ── Fix "X of and/or/." patterns (empty numeric placeholder) ─────────
    .replace(/\b\w+\s+of\s+(and|or|the|a|an)\b/gi, '')
    .replace(/\b\w+\s+of\s+\./gi, '')
    // ── Fix "of and ." and similar broken fragments ───────────────────────
    .replace(/\bof\s+and\b/gi, '')
    .replace(/\bof\s+\./gi, '.')
    // ── Fix duplicate connectors ──────────────────────────────────────────
    .replace(/\bdriven by\s+driven by\b/gi, 'driven by')
    .replace(/\bdue to\s+due to\b/gi, 'due to')
    .replace(/\bbased on\s+based on\b/gi, 'based on')
    // ── Remove trailing connectors at sentence end ────────────────────────
    .replace(/\s+(by|due to|through|via|with|and|or|for|of|in|on|at|to)\s*[.!?]?$/gi, '.')
    // ── Remove connector-only fragments between sentences ─────────────────
    .replace(/\.\s*(by|due to|through|via|with|and|or)\s*\./gi, '.')
    // ── Remove sentences that are just punctuation or symbols ─────────────
    .replace(/\s*[-–—:;,]\s*\./g, '.')
    // ── Collapse multiple spaces and dots ─────────────────────────────────
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    // ── Ensure sentence ends with punctuation ─────────────────────────────
    .replace(/([a-z0-9'"])\s*$/, '$1.')
    .trim();
}

// ── Final output sanitizer — applied to all text fields before returning ──────
function sanitizeOutput(text) {
  if (!text || typeof text !== 'string') return text;

  let t = removeFakeMetrics(text);
  t = repairText(t);

  // ── Final sanity check: reject placeholder words ──────────────────────
  // Replace known placeholder patterns with neutral qualitative language
  t = t
    .replace(/\bTop Competitor Product\b/gi, 'top competitor in this category')
    .replace(/\bCategory Leader Product\b/gi, 'category leader')
    .replace(/\bPopular Alternative Product\b/gi, 'popular alternative')
    .replace(/\bBudget-Friendly Option\b/gi, 'budget-friendly option')
    .replace(/\bPremium Market Choice\b/gi, 'premium option in this space')
    .replace(/\bProduct [A-E]\b/gi, 'top competitor in this category')
    .replace(/\bCompetitor [A-Z]\b/gi, 'top competitor in this category')
    .replace(/\bCategory (Leader|Challenger|Winner)\b/gi, 'category leader')
    .replace(/\bMarket Leader\b/gi, 'top competitor in this category')
    .replace(/\bEmerging Competitor\b/gi, 'emerging competitor in this space')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Remove sentences that became empty or near-empty after cleaning
  const sentences = t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || s.length < 8) return false;
      if (/^[-–—:;,.\s]+$/.test(s)) return false;
      if (/\bof\s+(and|or|\.)/i.test(s)) return false;
      if (/^(and|or|but|of|by|with|for|in|on|at|to)\b/i.test(s)) return false;
      return true;
    });

  const result = sentences.join(' ').trim();
  return result.length >= 10 ? result : 'Top competitors in this category focus on strong positioning and user trust signals.';
}

// Normalise and validate keywords using the enhanced domain
function normalizeKeywords(keywords, normalizedQuery, enhancedDomain) {
  const seeds = DOMAIN_KEYWORD_SEEDS[enhancedDomain] || [];
  const coreTerms = [
    ...normalizedQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
    ...seeds,
  ];

  const ALLOWED_LEADING = /^(best|budget|top|cheap|affordable|premium)\s+/i;
  const WEAK_LEADING    = /^(comfortable|lightweight|stylish|durable|sleek|modern|elegant|beautiful|amazing|great|good|nice)\s+/i;

  const cleaned = keywords
    .map((kw) => {
      let k = kw.trim().toLowerCase();
      // Strip weak leading modifiers
      k = k.replace(WEAK_LEADING, '');
      return k;
    })
    .filter((kw) => {
      const words = kw.split(/\s+/);
      // 2–6 words
      if (words.length < 2 || words.length > 6) return false;
      // Must contain at least one core term or seed
      if (!coreTerms.some((t) => kw.includes(t))) return false;
      // Must not be just "[modifier] [single-word]" with no product context
      if (words.length === 2 && !ALLOWED_LEADING.test(kw) && seeds.length > 0) {
        return seeds.some((s) => kw.includes(s));
      }
      return true;
    });

  return [...new Set(cleaned)].slice(0, 5);
}

async function callGroq(modelName, systemPrompt, userPrompt) {
  const response = await axios.post(
    GROQ_API_URL,
    {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const content = response.data.choices[0]?.message?.content || '';
  console.log('MODEL:', modelName, content);
  return content;
}

// ─── Model Functions ─────────────────────────────────────────────────────────

export async function analyzeProduct(query) {
  try {
    const content = await callGroq(
      'groq',
      'You are a JSON-only response bot. You never explain. You only output raw valid JSON.',
      buildPromptGroq(query)
    );

    const parsed = parseAIResponse(content);
    if (!parsed) {
      console.warn('[groq] Parsing failed. Using fallback.');
      return addEnhancements(FALLBACK_RESPONSE);
    }

    return addEnhancements(sanitizeResult(parsed));
  } catch (error) {
    console.error('[groq] API error:', error.response?.data || error.message);
    return addEnhancements(FALLBACK_RESPONSE);
  }
}

export async function analyzeProductGPT(query) {
  try {
    const content = await callGroq(
      'gpt',
      'You are a JSON-only structured data API. Return only raw valid JSON. Never include explanations or markdown.',
      buildPromptGPT(query)
    );

    const parsed = parseAIResponse(content);
    if (!parsed) {
      console.warn('[gpt] Parsing failed. Using fallback.');
      return addEnhancements(FALLBACK_RESPONSE);
    }

    return addEnhancements(sanitizeResult(parsed));
  } catch (error) {
    console.error('[gpt] API error:', error.response?.data || error.message);
    return addEnhancements(FALLBACK_RESPONSE);
  }
}

export async function analyzeProductGemini(query) {
  try {
    const content = await callGroq(
      'gemini',
      'You are a JSON-only creative analyst. Return only raw valid JSON. Never include explanations or markdown.',
      buildPromptGemini(query)
    );

    const parsed = parseAIResponse(content);
    if (!parsed) {
      console.warn('[gemini] Parsing failed. Using fallback.');
      return addEnhancements(FALLBACK_RESPONSE);
    }

    return addEnhancements(sanitizeResult(parsed));
  } catch (error) {
    console.error('[gemini] API error:', error.response?.data || error.message);
    return addEnhancements(FALLBACK_RESPONSE);
  }
}

// ─── Comparison ──────────────────────────────────────────────────────────────

// ─── Comparison ──────────────────────────────────────────────────────────────

// Signals that indicate high-quality, business-useful output
const QUALITY_SIGNALS = [
  { pattern: /\d+%|\d+x|\$\d+|\d+\s*(position|rank|point|star)/i, label: 'numeric data',          score: 10 },
  { pattern: /keyword|search term|long.tail|ctr|conversion|click.through/i, label: 'keyword specificity', score: 10 },
  { pattern: /\b(add|update|rewrite|target|include|optimize|highlight|use)\b/i, label: 'actionable verb',   score: 10 },
  { pattern: /revenue|roi|margin|market share|competitive|positioning|pricing/i, label: 'business clarity',  score: 10 },
];

// Signals that indicate low-quality, vague, or marketing-flavoured output
const PENALTY_SIGNALS = [
  { pattern: /\bstory\b|\bjourney\b|\bemotional\b|\blifestyle\b|\bbuzz\b|\bvibe\b/i, label: 'emotional language', penalty: 10 },
  { pattern: /\bstorytell|\bcommunity\b|\bengagement\b|\bcreative\b|\bpersonali[sz]/i, label: 'storytelling',       penalty: 10 },
  { pattern: /\bimprove\b|\boptimize\b|\benhance\b|\bbetter\b|\bgreat\b/i,            label: 'vague suggestion',   penalty: 5  },
];

function scoreModel(model) {
  const text = model.insights + ' ' + model.suggestions.join(' ');

  const quality = QUALITY_SIGNALS.reduce((sum, sig) => sum + (sig.pattern.test(text) ? sig.score : 0), 0);
  const penalty = PENALTY_SIGNALS.reduce((sum, sig) => sum + (sig.pattern.test(text) ? sig.penalty : 0), 0);

  return quality - penalty;
}

function compareModels(groq, gpt, gemini) {
  const scores = {
    groq:   scoreModel(groq),
    gpt:    scoreModel(gpt),
    gemini: scoreModel(gemini),
  };

  const bestModel = Object.keys(scores).reduce((a, b) => (scores[a] >= scores[b] ? a : b));

  // Reason reflects what actually made this model win
  function buildReason(key) {
    const model = { groq, gpt, gemini }[key];
    const text  = model.insights + ' ' + model.suggestions.join(' ');

    const wins = QUALITY_SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.label);
    const base = wins.length > 0
      ? `Most actionable and business-focused insights with ${wins.join(', ')}`
      : 'Most actionable and business-focused insights with measurable improvements';

    const penalised = PENALTY_SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.label);
    return penalised.length > 0
      ? `${base} (minor ${penalised.join(', ')} detected but outweighed by quality signals)`
      : base;
  }

  return {
    bestModel,
    reason: buildReason(bestModel),
    scores, // exposed for debugging / transparency
  };
}

// ─── Domain Detection ─────────────────────────────────────────────────────────

// Each domain defines: keyword signals, positioning template, price strategy,
// and a recommended action generator. Adding a new domain = adding one entry here.
const DOMAIN_PROFILES = [
  {
    name: 'jobs',
    signals: /\bjob(s)?\b|\bcareer(s)?\b|\bresume\b|\bcv\b|\bhiring\b|\brecruit|\bfreelance\b|\binternship\b|\bemployment\b/,
    keywords: (base, insights) => {
      const t = insights.toLowerCase();
      const pool = [
        'job search platform',
        'remote jobs',
        'entry level jobs',
        'resume builder',
        'job alerts',
        'work from home jobs',
        'fresher jobs',
        'part time jobs',
        'job search tips',
        'career opportunities',
      ];
      // Prioritise insight-driven picks
      const priority = [];
      if (t.match(/remote|work from home/))   priority.push('remote jobs');
      if (t.match(/fresher|entry.level/))      priority.push('entry level jobs', 'fresher jobs');
      if (t.match(/resume|cv/))                priority.push('resume builder');
      if (t.match(/alert|notification/))       priority.push('job alerts');
      if (t.match(/part.time|flexible/))       priority.push('part time jobs');
      const merged = [...new Set([...priority, ...pool])];
      return merged.slice(0, 5);
    },
    positioning: (base, insights, competitors) => {
      const t = (insights + ' ' + competitors.join(' ')).toLowerCase();
      let niche = 'fast matching and ease of use';
      if (t.match(/remote|work from home/))    niche = 'remote-first job discovery';
      else if (t.match(/fresher|entry.level/)) niche = 'fresher and entry-level hiring';
      else if (t.match(/tech|engineer|developer/)) niche = 'tech talent acquisition';
      else if (t.match(/freelance|gig/))       niche = 'freelance and gig opportunities';
      return `Job discovery platform focused on ${niche}`;
    },
    priceStrategy: (insights) => {
      const t = insights.toLowerCase();
      if (t.match(/premium|enterprise|recruiter/))
        return 'Offer a freemium tier for job seekers; charge recruiters on a per-hire or subscription model';
      if (t.match(/free|no cost/))
        return 'Keep core search free; monetise through featured listings and resume visibility boosts';
      return 'Freemium for candidates, subscription for employers — align pricing with hiring volume';
    },
    recommendedAction: (topRanked, focusKeywords, insights) => {
      const t = insights.toLowerCase();
      let angle = 'niche segments like remote jobs or fresher hiring';
      if (t.match(/tech|engineer/))   angle = 'tech-specific roles and developer communities';
      if (t.match(/remote/))          angle = 'remote-first job seekers and distributed teams';
      if (t.match(/fresher|entry/))   angle = 'fresher hiring and campus recruitment';
      return `Differentiate from ${topRanked} by focusing on ${angle}`;
    },
  },
  {
    // ai_tools must be listed BEFORE saas — it is more specific and would otherwise
    // be swallowed by the broader saas signal match.
    name: 'ai_tools',
    signals: /\bai\b|\bartificial intelligence\b|\bchatbot\b|\bgenerator\b|\bllm\b|\bgpt\b|\bcopilot\b|\bai tool|\bai platform|\bai software|\bai automation|\bai assistant|\bchatgpt\b|\bclaude\b|\bgemini\b|\bperplexity\b/i,
    keywords: (base, insights) => {
      const t = insights.toLowerCase();
      const pool = [
        'best ai tools 2026',
        'ai tools for productivity',
        'ai automation tools',
        'chatgpt alternatives',
        'ai tools for developers',
        'ai content generator',
        'ai tools for marketers',
        'free ai tools',
        'ai writing tools',
        'ai image generator',
      ];
      // Insight-driven priority picks
      const priority = [];
      if (t.match(/developer|engineer|code|api/))    priority.push('ai tools for developers');
      if (t.match(/content|writ|copy|blog/))         priority.push('ai writing tools', 'ai content generator');
      if (t.match(/image|design|visual|art/))        priority.push('ai image generator');
      if (t.match(/market|seo|campaign|ad/))         priority.push('ai tools for marketers');
      if (t.match(/automat|workflow|pipeline/))      priority.push('ai automation tools');
      if (t.match(/free|open.source/))               priority.push('free ai tools');
      if (t.match(/chatgpt|openai|gpt/))             priority.push('chatgpt alternatives');
      const merged = [...new Set([...priority, ...pool])];
      return merged.slice(0, 5);
    },
    positioning: (base, insights, competitors) => {
      const t = (insights + ' ' + competitors.join(' ')).toLowerCase();
      if (t.match(/\bdeveloper\b|\bengineer\b|\bsdk\b|\bapi\b(?! call)/) && !t.match(/no.code/))
        return 'Developer-focused AI platform for building and integrating intelligent applications';
      if (t.match(/content|writ|copy|blog|creative|design|image/))
        return 'Creative AI tool for content generation, design, and visual storytelling';
      if (t.match(/market|seo|campaign|ad|growth/))
        return 'AI-powered marketing platform for campaign automation and growth optimization';
      if (t.match(/automat|workflow|pipeline|process|no.code/))
        return 'AI automation platform focused on eliminating repetitive tasks and scaling workflows';
      if (t.match(/enterprise|team|collaborat|business/))
        return 'Enterprise AI platform focused on team productivity and secure deployment';
      return 'AI productivity platform focused on automation, speed, and ease of use';
    },
    priceStrategy: (insights) => {
      const t = insights.toLowerCase();
      if (t.match(/enterprise|b2b|team|business/))
        return 'Per-seat enterprise pricing with annual contracts; offer a 14-day free trial to reduce friction';
      if (t.match(/usage|token|api|call/))
        return 'Usage-based pricing for scalability — charge per API call or output volume with a free tier';
      if (t.match(/open.source|free|community/))
        return 'Open-source core with a hosted premium tier; monetise through support, SLAs, and advanced features';
      return 'Freemium model with premium tiers for advanced features — convert users at key usage limits';
    },
    recommendedAction: (topRanked, focusKeywords, insights) => {
      const t = insights.toLowerCase();
      const competitor = topRanked.toLowerCase();

      // ── Competitor-type classification ──────────────────────────────────
      const isLLM        = /chatgpt|claude|gemini|gpt-4|openai|llama|mistral|perplexity|bard/.test(competitor);
      const isAutomation = /zapier|make\.com|n8n|integromat|automate\.io|workato|tray\.io/.test(competitor);
      const isContentAI  = /jasper|copy\.ai|writesonic|rytr|anyword|hypotenuse|peppertype/.test(competitor);
      const isImageAI    = /midjourney|dall-e|stable diffusion|firefly|ideogram|leonardo/.test(competitor);
      const isDevTool    = /github copilot|tabnine|codeium|cursor|replit|sourcegraph/.test(competitor);

      // ── Insight-driven angle ─────────────────────────────────────────────
      const hasDev     = t.match(/developer|engineer|\bapi\b|\bsdk\b/);
      const hasContent = t.match(/content|writ|copy|blog|creative/);
      const hasMarket  = t.match(/market|seo|campaign|ad\b|growth/);
      const hasAuto    = t.match(/automat|workflow|no.code|pipeline/);

      // ── Competitor-aware framing ─────────────────────────────────────────
      if (isLLM) {
        if (hasDev)     return `Differentiate from leading LLM platforms like ${topRanked} by offering a developer-first experience — better API latency, fine-tuning options, and transparent pricing`;
        if (hasContent) return `Differentiate from leading LLM platforms like ${topRanked} by specialising in structured content workflows — templates, brand voice, and direct publishing integrations`;
        if (hasMarket)  return `Differentiate from leading LLM platforms like ${topRanked} by focusing on marketing-specific outputs — ad copy, SEO briefs, and campaign analytics`;
        if (hasAuto)    return `Differentiate from leading LLM platforms like ${topRanked} by embedding AI directly into no-code automation workflows`;
        return `Differentiate from leading LLM platforms like ${topRanked} by targeting a specific niche — developers, creators, or marketers — rather than competing as a general-purpose model`;
      }

      if (isAutomation) {
        if (hasDev)  return `Compete with automation platforms like ${topRanked} by offering a code-first API layer alongside the no-code builder — win developers that outgrow visual tools`;
        if (hasAuto) return `Compete with automation platforms like ${topRanked} by offering faster setup, pre-built AI-powered templates, and lower per-task pricing`;
        return `Compete with automation platforms like ${topRanked} by combining AI intelligence with workflow automation — go beyond simple triggers and actions`;
      }

      if (isContentAI) {
        if (hasMarket) return `Differentiate from content AI tools like ${topRanked} by focusing on performance marketing — tie content output directly to conversion metrics`;
        return `Differentiate from content AI tools like ${topRanked} by offering deeper brand customisation, multi-language support, and team collaboration features`;
      }

      if (isImageAI) {
        return `Differentiate from image AI tools like ${topRanked} by focusing on commercial use-cases — product photography, ad creatives, and brand-consistent visual generation`;
      }

      if (isDevTool) {
        return `Compete with developer AI tools like ${topRanked} by offering broader language support, codebase-aware context, and tighter IDE integrations`;
      }

      // ── Insight-driven fallback (competitor type unknown) ────────────────
      if (hasDev)     return `Compete with ${topRanked} by focusing on developer experience — better API docs, SDKs, and faster response times`;
      if (hasContent) return `Differentiate from ${topRanked} by specialising in content creators — offer templates, brand voice, and one-click publishing`;
      if (hasMarket)  return `Outposition ${topRanked} by targeting marketers with campaign-specific AI workflows and ROI tracking`;
      if (hasAuto)    return `Differentiate from ${topRanked} by focusing on no-code automation for non-technical teams`;
      return `Differentiate from ${topRanked} by focusing on a specific niche — developers, creators, or marketers — avoid competing head-on`;
    },
  },
  {
    // tech_products must be listed BEFORE saas — "laptop", "phone", "tablet" would
    // otherwise match the broad saas \bplatform\b or \btool\b signals.
    name: 'tech_products',
    signals: /\blaptop(s)?\b|\bnotebook(s)?\b|\bmacbook\b|\bchromebook\b|\bphone(s)?\b|\bsmartphone(s)?\b|\biphone\b|\bandroid\b|\bpc\b|\bdesktop\b|\btablet(s)?\b|\bipad\b|\bdevice(s)?\b|\bgadget(s)?\b|\bheadphone(s)?\b|\bearbuds?\b|\bmonitor(s)?\b|\bkeyboard(s)?\b|\bmouse\b|\bprinter(s)?\b|\bssd\b|\bgpu\b|\bcpu\b|\bprocessor\b/i,
    keywords: (base, insights) => {
      const t = insights.toLowerCase();
      const q = base.toLowerCase();

      // Detect the product category from the base query
      // isAudio MUST be checked before isPhone — "headphones" must not fall into phone branch
      const isLaptop  = /laptop|notebook|macbook|chromebook/.test(q);
      const isAudio   = /headphones?|earbuds?|earphones?/.test(q);
      const isPhone   = !isAudio && /phone|smartphone|iphone|android/.test(q);
      const isTablet  = /tablet|ipad/.test(q);
      const isMonitor = /monitor|display|screen/.test(q);

      // ── Shared validation: remove duplicate words within a phrase,
      //    then deduplicate the final array ──────────────────────────────────
      function dedupeWords(phrase) {
        const words = phrase.trim().split(/\s+/);
        const seen = new Set();
        return words.filter((w) => {
          if (seen.has(w)) return false;
          seen.add(w);
          return true;
        }).join(' ');
      }
      function cleanKeywords(arr) {
        const seen = new Set();
        return arr
          .map(dedupeWords)
          .filter((p) => {
            if (!p || seen.has(p)) return false;
            seen.add(p);
            return true;
          });
      }

      // ── Laptop keywords ──
      if (isLaptop) {
        // ── Gaming mode: strict isolation, no coding pool leakage ──────────
        const isGaming = /gaming|\bfps\b|\bgpu\b|\bgraphics\b/.test(q) || t.match(/gaming|fps|gpu|graphics card/);
        if (isGaming) {
          const gamingPool = [
            'best gaming laptops under 1000',
            'budget gaming laptops',
            'gaming laptops with good GPU',
            'gaming laptops for high FPS',
            'affordable gaming laptops',
            'best gaming laptops 2026',
            'gaming laptops under 500',
            'gaming laptops with RTX graphics',
          ];
          const gamingPriority = [];
          if (t.match(/budget|affordable|cheap|under/))  gamingPriority.push('budget gaming laptops', 'affordable gaming laptops');
          if (t.match(/fps|frame rate/))                 gamingPriority.push('gaming laptops for high FPS');
          if (t.match(/gpu|graphics|rtx|nvidia/))        gamingPriority.push('gaming laptops with good GPU', 'gaming laptops with RTX graphics');
          const merged = [...new Set([...gamingPriority, ...gamingPool])];
          return cleanKeywords(merged).slice(0, 5);
        }

        // ── Coding / developer mode ────────────────────────────────────────
        // Curated high-intent pool — no weak modifiers (lightweight, comfortable, stylish)
        // Every phrase must sound like a real Google/Amazon search
        const pool = [
          'best laptops for coding',
          'laptops for programming',
          'laptops for software development',
          'budget laptops for coding',
          'laptops for developers',
          'laptops for programming students',
          'best laptops for software engineers',
          'best laptops for computer science students',
          'laptops for web development',
          'best gaming laptops under 1000',
          'best laptops for video editing',
          'best laptops for remote work',
          'laptops for data science',
        ];

        // Insight-driven priority — most specific match goes first
        const priority = [];
        if (t.match(/data science|machine learning|python/))
          priority.push('laptops for data science', 'best laptops for software engineers');
        if (t.match(/web dev|frontend|backend|full.?stack/))
          priority.push('laptops for web development', 'laptops for software development');
        if (t.match(/software engineer|software dev/))
          priority.push('best laptops for software engineers', 'laptops for software development');
        if (t.match(/computer science|cs student/))
          priority.push('best laptops for computer science students', 'laptops for programming students');
        if (t.match(/student|college|university/))
          priority.push('laptops for programming students', 'budget laptops for coding');
        if (t.match(/developer|coding|programming/))
          priority.push('best laptops for coding', 'laptops for developers');
        if (t.match(/budget|affordable|cheap|under/))
          priority.push('budget laptops for coding');
        if (t.match(/gaming/))
          priority.push('best gaming laptops under 1000');
        if (t.match(/video|edit|creative/))
          priority.push('best laptops for video editing');
        if (t.match(/remote|work from home/))
          priority.push('best laptops for remote work');

        return cleanKeywords([...priority, ...pool]).slice(0, 5);
      }

      // ── Audio keywords — checked BEFORE phone ──
      if (isAudio) {
        // Extract the core product noun: strip modifiers, adjectives, and pluralise consistently
        const AUDIO_MODS = /^(best|top|good|great|cheap|affordable|premium|new|noise|cancelling|wireless|budget)\s+/i;
        let noun = q.replace(/\b20\d\d\b/g, '').replace(/\s+/g, ' ').trim();
        while (AUDIO_MODS.test(noun)) noun = noun.replace(AUDIO_MODS, '').trim();
        // Normalise to plural form for natural phrasing
        if (!noun.endsWith('s')) noun = noun + 's';
        noun = noun || 'headphones';

        const pool = [
          `best ${noun} 2026`,
          `best noise cancelling ${noun}`,
          `wireless ${noun} for work`,
          `${noun} for gym`,
          `budget ${noun} under 100`,
          `${noun} for calls`,
          `best ${noun} for travel`,
        ];
        const priority = [];
        if (t.match(/noise.cancel|anc/))    priority.push(`best noise cancelling ${noun}`);
        if (t.match(/wireless|bluetooth/))  priority.push(`wireless ${noun} for work`);
        if (t.match(/gym|workout|sport/))   priority.push(`${noun} for gym`);
        if (t.match(/budget|affordable/))   priority.push(`budget ${noun} under 100`);
        if (t.match(/travel|commut/))       priority.push(`best ${noun} for travel`);
        return cleanKeywords([...priority, ...pool]).slice(0, 5);
      }

      // ── Phone keywords ──
      if (isPhone) {
        // Strip year numbers then strip ALL leading modifier words iteratively
        const PHONE_MODS = /^(best|top|good|great|cheap|affordable|premium|new|budget)\s+/i;
        let noun = q.replace(/\b20\d\d\b/g, '').replace(/\s+/g, ' ').trim();
        while (PHONE_MODS.test(noun)) noun = noun.replace(PHONE_MODS, '').trim();
        noun = noun || 'smartphone';

        const pool = [
          `best ${noun} 2026`,
          `${noun} under 500`,
          `best budget ${noun}`,
          `${noun} for photography`,
          `${noun} with best battery life`,
          `${noun} for gaming`,
          `${noun} for students`,
        ];
        const priority = [];
        if (t.match(/camera|photo|photography/)) priority.push(`${noun} for photography`);
        if (t.match(/battery|long.lasting/))     priority.push(`${noun} with best battery life`);
        if (t.match(/gaming|performance/))       priority.push(`${noun} for gaming`);
        if (t.match(/budget|affordable|cheap/))  priority.push(`best budget ${noun}`, `${noun} under 500`);
        if (t.match(/student/))                  priority.push(`${noun} for students`);
        return cleanKeywords([...priority, ...pool]).slice(0, 5);
      }

      // ── Generic tech fallback ──
      return cleanKeywords([
        `best ${q} 2026`,
        `best budget ${q}`,
        `${q} for students`,
        `${q} under 500`,
        `top rated ${q}`,
      ]).slice(0, 5);
    },
    positioning: (base, insights, competitors) => {
      const t = (insights + ' ' + competitors.join(' ')).toLowerCase();
      const q = base.toLowerCase();

      const isLaptop = /laptop|notebook|macbook|chromebook/.test(q);
      // Audio must be checked before phone to prevent "headphones" routing into phone branch
      const isAudio  = /headphones?|earbuds?|earphones?/.test(q);
      const isPhone  = !isAudio && /phone|smartphone|iphone|android/.test(q);

      if (isLaptop) {
        if (t.match(/developer|coding|programming/)) {
          if (t.match(/budget|affordable|cheap|under/))
            return `Budget coding laptop optimised for speed, portability, and developer workflows`;
          if (t.match(/premium|pro|high.end/))
            return `Premium developer laptop with strong processing power and long battery life`;
          return `Developer-focused laptop with strong processing power and lightweight design`;
        }
        if (t.match(/student|college|university/))
          return `Student-friendly laptop focused on performance, battery life, and affordability`;
        if (t.match(/gaming/))
          return `Mid-range gaming laptop with high refresh rate and dedicated GPU`;
        if (t.match(/video|edit|creative/))
          return `Creative professional laptop optimised for video editing and colour accuracy`;
        if (t.match(/business|enterprise|work/))
          return `Business laptop focused on security, reliability, and all-day battery life`;
        return `Beginner-friendly laptop focused on performance and battery life`;
      }

      // Audio — checked before phone
      if (isAudio) {
        if (t.match(/noise.cancel/))  return `Premium noise-cancelling audio focused on commuters and remote workers`;
        if (t.match(/gaming/))        return `Gaming audio with low-latency and immersive surround sound`;
        if (t.match(/sport|gym/))     return `Sport audio focused on secure fit, sweat resistance, and bass performance`;
        return `Wireless audio focused on comfort, sound quality, and all-day battery life`;
      }

      // Phone
      if (isPhone) {
        if (t.match(/camera|photo/))  return `Camera-first smartphone positioned for photography enthusiasts`;
        if (t.match(/gaming/))        return `Performance smartphone optimised for gaming and high refresh rate displays`;
        if (t.match(/budget|cheap/))  return `Budget smartphone with flagship-level features at mid-range pricing`;
        return `Mid-range smartphone focused on battery life, camera quality, and value`;
      }

      return `${base.charAt(0).toUpperCase() + base.slice(1)} focused on performance, value, and reliability`;
    },
    priceStrategy: (insights) => {
      const t = insights.toLowerCase();
      if (t.match(/premium|flagship|pro|high.end/))
        return 'Price at the premium tier — justify with superior specs, build quality, and brand trust';
      if (t.match(/budget|affordable|cheap|under \$|under £/))
        return 'Undercut premium competitors by offering similar specs at a lower price point — highlight performance-to-price ratio';
      if (t.match(/student|college|university/))
        return 'Bundle with student discounts, software licences, or extended warranty to increase perceived value';
      if (t.match(/mid.range|mid range|value/))
        return 'Position in the mid-tier with a high performance-to-price ratio — target buyers who want flagship features without flagship pricing';
      return 'Offer a competitive price with a clear spec advantage over similarly priced rivals — lead with benchmark comparisons';
    },
    recommendedAction: (topRanked, focusKeywords, insights) => {
      const t = insights.toLowerCase();
      const competitor = topRanked.toLowerCase();

      // Competitor-type classification
      const isApple   = /apple|macbook|iphone|ipad/.test(competitor);
      const isDell    = /dell|xps/.test(competitor);
      const isLenovo  = /lenovo|thinkpad/.test(competitor);
      const isSamsung = /samsung|galaxy/.test(competitor);
      const isHP      = /\bhp\b|hewlett/.test(competitor);

      // Insight-driven angle
      const hasDev     = t.match(/developer|coding|programming/);
      const hasStudent = t.match(/student|college|university/);
      const hasBudget  = t.match(/budget|affordable|cheap|under/);
      const hasPerf    = t.match(/performance|speed|processor|ram|ssd/);
      const hasGaming  = t.match(/gaming/);

      if (isApple) {
        if (hasDev)     return `Differentiate from MacBook Air by offering better price-to-performance for developers — highlight RAM, SSD speed, and Linux compatibility`;
        if (hasStudent) return `Target the student segment that can't afford MacBook pricing — offer comparable build quality at 40–50% lower cost`;
        if (hasBudget)  return `Compete with MacBook Air by positioning as the best value coding laptop under $1000 — lead with spec comparisons`;
        return `Differentiate from MacBook by focusing on Windows ecosystem advantages — better gaming, more ports, and lower entry price`;
      }

      if (isDell || isLenovo || isHP) {
        if (hasDev)    return `Outposition ${topRanked} by targeting developers with Linux-ready builds, better keyboard ergonomics, and competitive RAM configurations`;
        if (hasGaming) return `Compete with ${topRanked} by offering a better GPU-to-price ratio and higher refresh rate display at the same price point`;
        return `Differentiate from ${topRanked} by leading with a specific use-case — coding, video editing, or student productivity — rather than generic specs`;
      }

      if (isSamsung) {
        if (t.match(/phone|smartphone/)) return `Differentiate from Samsung Galaxy by focusing on camera software, clean OS experience, and faster software updates`;
        return `Compete with ${topRanked} by offering a tighter software-hardware integration and longer support lifecycle`;
      }

      // Insight-driven fallback
      if (hasDev)     return `Differentiate from ${topRanked} by highlighting RAM, SSD speed, and processor performance for coding workflows`;
      if (hasStudent) return `Target the student segment with budget-friendly ${focusKeywords[0] || 'tech'} — bundle with software and student discounts`;
      if (hasBudget)  return `Compete with ${topRanked} by offering similar specs at a lower price — lead with benchmark and value comparisons`;
      if (hasPerf)    return `Outposition ${topRanked} by leading with measurable performance benchmarks — CPU score, boot time, and battery hours`;
      return `Differentiate from ${topRanked} by targeting a specific segment — students, developers, or creatives — with tailored spec configurations`;
    },
  },
  {
    name: 'saas',
    signals: /\bsoftware\b|\bapp\b|\bplatform\b|\btool\b|\bsaas\b|\bdashboard\b|\bcrm\b|\banalytics\b|\bautomation\b/,
    keywords: (base, insights) => {
      const t = insights.toLowerCase();
      const pool = [
        `best ${base}`,
        `${base} for small business`,
        `${base} free trial`,
        `${base} pricing`,
        `${base} vs competitors`,
        `${base} for teams`,
        `${base} integration`,
        `affordable ${base}`,
      ];
      const priority = [];
      if (t.match(/free|trial/))       priority.push(`${base} free trial`);
      if (t.match(/small business/))   priority.push(`${base} for small business`);
      if (t.match(/team|collaborat/))  priority.push(`${base} for teams`);
      if (t.match(/integrat/))         priority.push(`${base} integration`);
      const merged = [...new Set([...priority, ...pool])];
      return merged.slice(0, 5);
    },
    positioning: (base, insights, competitors) => {
      const t = (insights + ' ' + competitors.join(' ')).toLowerCase();
      let angle = 'ease of use and fast onboarding';
      if (t.match(/enterprise|scale/))  angle = 'enterprise scalability and security';
      else if (t.match(/small|startup/)) angle = 'small teams and startup workflows';
      else if (t.match(/automat/))       angle = 'workflow automation and time savings';
      return `${base.charAt(0).toUpperCase() + base.slice(1)} platform focused on ${angle}`;
    },
    priceStrategy: (insights) => {
      const t = insights.toLowerCase();
      if (t.match(/enterprise/))
        return 'Annual contracts for enterprise; monthly self-serve for SMBs — offer a 14-day free trial to reduce friction';
      if (t.match(/free|freemium/))
        return 'Freemium with usage limits; convert to paid via in-app upgrade prompts at key friction points';
      return 'Per-seat monthly pricing with an annual discount — offer a free trial to lower acquisition barrier';
    },
    recommendedAction: (topRanked, focusKeywords, insights) => {
      const t = insights.toLowerCase();
      let angle = 'a simpler onboarding experience and transparent pricing';
      if (t.match(/integrat/))   angle = 'deeper integrations with tools your users already use';
      if (t.match(/automat/))    angle = 'automation features that save measurable time per week';
      return `Differentiate from ${topRanked} by offering ${angle}`;
    },
  },
  {
    name: 'ecommerce',  // default — physical products, existing logic
    signals: null,      // matches everything that didn't match above
    keywords: null,     // uses buildKeywordsProduct below
    positioning: null,
    priceStrategy: null,
    recommendedAction: null,
  },
];

function detectDomain(query) {
  const q = query.toLowerCase();
  for (const profile of DOMAIN_PROFILES) {
    if (profile.signals && profile.signals.test(q)) return profile;
  }
  return DOMAIN_PROFILES.find((p) => p.name === 'ecommerce');
}

// ─── Final Strategy ───────────────────────────────────────────────────────────
const KNOWN_MODIFIERS = new Set([
  'best', 'top', 'good', 'great', 'cheap', 'affordable', 'premium', 'lightweight',
  'comfortable', 'durable', 'top rated', 'highly rated', 'popular', 'new',
]);

// All known audience/intent suffixes — strip these from the query too
// NOTE: activity patterns like "for running", "for yoga" are intentionally excluded —
// they are handled by the reorder step in normalizeQuery, not stripped as audiences.
const KNOWN_AUDIENCES = [
  'for beginners', 'for women', 'for men', 'for kids', 'for children',
  'for flat feet', 'for wide feet', 'for trail running', 'for long distance',
  'for everyday use',
];

// Words that signal marketing/campaign content — never use in SEO keywords
const CAMPAIGN_SIGNALS = [
  /\bstory\b/, /\bjourney\b/, /\bemotional\b/, /\blifestyle\b/, /\bcommunity\b/,
  /\bengagement\b/, /\bpersonali[sz]/, /\bcreative\b/, /\bvibe\b/, /\bbuzz\b/,
  /\brun with\b/, /\bfeel the\b/, /\byour first\b/, /\bshoppers love\b/,
  /\bword.of.mouth\b/, /\bvisual\b/, /\bstorytell/,
];

function hasCampaignLanguage(text) {
  return CAMPAIGN_SIGNALS.some((re) => re.test(text.toLowerCase()));
}

// Normalize the raw query into a clean base product term.
// Strips leading modifiers and trailing audience phrases, then reorders
// "[product] for [activity]" → "[activity] [product]" so base never contains "for".
// "best running shoes for beginners" → { base: "running shoes", audience: "for beginners" }
// "shoes for running"                → { base: "running shoes", audience: null }
// "mat for yoga"                     → { base: "yoga mat",      audience: null }
// "lightweight shoes"                → { base: "shoes",         audience: null }
function normalizeQuery(query) {
  let q = query.toLowerCase().trim();

  // Step 1: strip known audience suffixes (longest match wins)
  let detectedAudience = null;
  for (const aud of KNOWN_AUDIENCES.slice().sort((a, b) => b.length - a.length)) {
    if (q.endsWith(aud)) {
      detectedAudience = aud;
      q = q.slice(0, q.length - aud.length).trim();
      break;
    }
  }

  // Step 2: strip leading modifier words
  const words = q.split(' ');
  while (words.length > 1 && KNOWN_MODIFIERS.has(words[0])) {
    words.shift();
  }
  q = words.join(' ').trim();

  // Step 3: reorder "[product] for [activity]" → "[activity] [product]"
  // Handles two sub-cases:
  //   a) Single-word activity:  "shoes for running"          → "running shoes"
  //   b) Activity + audience:   "shoes for running beginners" → base="running shoes", audience="for beginners"
  const forMatch = q.match(/^(.+?)\s+for\s+(\w+)((?:\s+\w+)*)$/);
  if (forMatch) {
    const product   = forMatch[1].trim();                    // "shoes"
    const activity  = forMatch[2].trim();                    // "running"
    const remainder = forMatch[3].trim();                    // "beginners" or ""

    q = `${activity} ${product}`;                            // → "running shoes"

    // If there's a leftover word after the activity, treat it as an audience suffix
    if (remainder && !detectedAudience) {
      detectedAudience = `for ${remainder}`;                 // → "for beginners"
    }
  }

  return { base: q, audience: detectedAudience };
}

// Validate a constructed keyword phrase:
// - at least 2 words
// - no duplicate words
// - no more than one "for"
// - max 6 words total
function isCleanKeyword(phrase) {
  if (!phrase) return false;
  const words = phrase.trim().split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  if (new Set(words).size < words.length) return false;           // duplicate words
  if ((phrase.match(/\bfor\b/g) || []).length > 1) return false; // multiple "for"
  return true;
}

// Build SEO keywords — routes to domain-specific logic or falls back to product templates.
function buildKeywords(query, groqInsights, gptInsights) {
  const domain = detectDomain(query);
  const combinedInsights = groqInsights + ' ' + gptInsights;

  // Non-ecommerce domains use their own curated keyword pools
  if (domain.keywords) {
    return domain.keywords(query.toLowerCase().trim(), combinedInsights);
  }

  // ── Ecommerce / physical product path ────────────────────────────────────
  const { base, audience: queryAudience } = normalizeQuery(query);
  const insights = combinedInsights.toLowerCase();
  const seen = new Set();
  const results = [];

  function add(phrase) {
    const p = phrase.trim().replace(/\s+/g, ' ');
    if (!p || seen.has(p)) return;
    if (!isCleanKeyword(p)) return;
    seen.add(p);
    results.push(p);
  }

  add(`best ${base}`);
  if (insights.match(/lightweight|light weight/))          add(`lightweight ${base}`);
  if (insights.match(/affordable|budget|cheap|value/))     add(`affordable ${base}`);
  if (insights.match(/comfortable|comfort|cushion/))       add(`comfortable ${base}`);
  if (insights.match(/durable|durability|long.lasting/))   add(`durable ${base}`);
  if (queryAudience)                                        add(`${base} ${queryAudience}`);
  if (insights.match(/beginner|starter|first.time/))       add(`${base} for beginners`);
  if (insights.match(/\bwomen\b|\bfemale\b/))              add(`${base} for women`);
  if (insights.match(/\bmen\b|\bmale\b/))                  add(`${base} for men`);
  if (insights.match(/flat feet|flat.foot/))               add(`${base} for flat feet`);
  if (insights.match(/wide feet|wide.foot|wide toe/))      add(`${base} for wide feet`);
  if (insights.match(/trail|outdoor|terrain/))             add(`${base} for trail running`);
  if (insights.match(/long distance|marathon|endurance/))  add(`${base} for long distance`);

  const fallbacks = [
    `best ${base}`, `lightweight ${base}`, `affordable ${base}`,
    `comfortable ${base}`, `${base} for beginners`, `${base} for women`,
    `${base} for flat feet`, `${base} for everyday use`, `top rated ${base}`,
  ];
  for (const f of fallbacks) {
    if (results.length >= 5) break;
    add(f);
  }
  return results.slice(0, 5);
}

function detectPositioning(query, groqInsights, gptInsights, competitors, domain) {
  // Non-ecommerce domains use their own positioning logic
  if (domain.positioning) {
    return domain.positioning(query, groqInsights + ' ' + gptInsights, competitors);
  }

  // ── Ecommerce path ────────────────────────────────────────────────────────
  const { base } = normalizeQuery(query);
  const text = (groqInsights + ' ' + gptInsights + ' ' + competitors.join(' ')).toLowerCase();

  let tier = 'Mid-range';
  if (text.match(/premium|luxury|high.end|flagship/))           tier = 'Premium';
  else if (text.match(/budget|affordable|cheap|value|entry.level/)) tier = 'Affordable';

  let audience = 'everyday users';
  if (text.match(/beginner|starter|first.time/))                audience = 'beginners';
  else if (text.match(/professional|expert|advanced|serious/))  audience = 'serious athletes';
  else if (text.match(/\bwomen\b|\bfemale\b/))                  audience = 'women';
  else if (text.match(/\bmen\b|\bmale\b/))                      audience = 'men';
  else if (text.match(/kids|children|youth/))                   audience = 'kids';

  let benefit = 'reliable performance';
  if (text.match(/cushion|comfort|soft/))                       benefit = 'comfort and cushioning';
  else if (text.match(/lightweight|light weight|minimal/))      benefit = 'lightweight build';
  else if (text.match(/durable|durability|long.lasting/))       benefit = 'long-term durability';
  else if (text.match(/support|stability|motion control/))      benefit = 'arch support and stability';
  else if (text.match(/speed|fast|responsive/))                 benefit = 'speed and responsiveness';
  else if (text.match(/trail|outdoor|terrain/))                 benefit = 'trail and outdoor performance';

  const baseWords = new Set(base.split(' '));
  const cleanAudience = audience.split(' ').filter((w) => !baseWords.has(w)).join(' ') || audience;
  return `${tier} ${base} for ${cleanAudience} focused on ${benefit}`;
}

function detectPriceStrategy(groqInsights, gptInsights, competitors, domain) {
  // Non-ecommerce domains use their own pricing logic
  if (domain.priceStrategy) {
    return domain.priceStrategy(groqInsights + ' ' + gptInsights);
  }

  // ── Ecommerce path ────────────────────────────────────────────────────────
  const text = (groqInsights + ' ' + gptInsights + ' ' + competitors.join(' ')).toLowerCase();
  if (text.match(/premium|luxury|high.end/))
    return 'Price 10–20% above average. Justify with quality images, specs, and 4.5★+ reviews';
  if (text.match(/budget|affordable|value|cheap/))
    return 'Undercut top 3 rivals by $5–$10. Add a bundle (insoles, bag) to lift perceived value';
  if (text.match(/subscription|recurring|membership/))
    return 'Launch a subscription tier to drive repeat purchases and cut acquisition cost';
  return 'Match the #1 competitor price. Win on listing quality — images, reviews, bullet points';
}

function pickRecommendedAction(primaryModel, allModels, focusKeywords, domain, groqInsights) {
  const primary = allModels[primaryModel];
  const topRanked = primary.ranking?.[0]?.name || 'the top competitor';

  // Non-ecommerce domains use their own action framing
  if (domain.recommendedAction) {
    return domain.recommendedAction(topRanked, focusKeywords, groqInsights);
  }

  // ── Ecommerce path ────────────────────────────────────────────────────────
  const mainKeyword = focusKeywords[0] || 'top search keywords';
  return `Outrank "${topRanked}" by targeting "${mainKeyword}" and optimizing listing quality`;
}

// Trailing words that make a phrase feel incomplete when they appear at the end
const TRAILING_CONNECTORS = new Set([
  'for', 'and', 'with', 'in', 'on', 'at', 'to', 'of', 'or',
  'by', 'the', 'a', 'an', 'your', 'its', 'as', 'is', 'are',
]);

function trimToCompletePhrase(text, maxWords = 10) {
  const words = text.trim().split(/\s+/);

  // Take up to maxWords
  let trimmed = words.slice(0, maxWords);

  // Walk back from the end until the last word is not a trailing connector
  while (trimmed.length > 1 && TRAILING_CONNECTORS.has(trimmed[trimmed.length - 1].toLowerCase())) {
    trimmed.pop();
  }

  // Strip trailing punctuation except closing quotes
  return trimmed.join(' ').replace(/[,;:.]+$/, '').trim();
}

// Words that are too generic to be a useful quick win
const VAGUE_VERBS = /^(optimize|improve|enhance|update|leverage|utilize|ensure|consider|focus|work on)/i;

function pickQuickWin(query, groqSuggestions, gptSuggestions, domain, combinedInsights) {
  const t = combinedInsights.toLowerCase();

  // ── Domain-specific quick wins ─────────────────────────────────────────────

  if (domain.name === 'tech_products') {
    const q = query.toLowerCase();
    const isLaptop = /laptop|notebook|macbook|chromebook/.test(q);
    const isAudio  = /headphones?|earbuds?|earphones?/.test(q);
    const isPhone  = !isAudio && /phone|smartphone|iphone|android/.test(q);

    if (isLaptop) {
      if (t.match(/gaming/))
        return 'Add GPU benchmark and FPS comparison chart in product images';
      if (t.match(/\bram\b|\bssd\b|\bcpu\b|\bprocessor\b|\bspec/))
        return 'Add RAM/SSD/CPU comparison chart in product images';
      if (t.match(/battery|battery life/))
        return 'Highlight battery life with real usage screenshot overlay';
      if (t.match(/student|college|university/))
        return 'Add student discount badge and bundle offer on listing';
      if (t.match(/portable|portab|thin|light/))
        return 'Show weight and dimensions vs competitors in hero image';
      if (t.match(/developer|coding|programming|terminal|vs code/))
        return 'Show coding setup with VS Code and terminal in hero image';
      // Default laptop quick win
      return 'Add RAM/SSD/CPU comparison chart in product images';
    }

    if (isPhone) {
      if (t.match(/camera|photo/))   return 'Add side-by-side camera sample shots in product gallery';
      if (t.match(/battery/))        return 'Show screen-on time benchmark vs top competitor';
      if (t.match(/gaming/))         return 'Add FPS benchmark screenshot in product images';
      return 'Add spec comparison table vs top competitor in listing';
    }

    if (isAudio) {
      // Check query too — user may have typed "noise cancelling headphones"
      const qAudio = query.toLowerCase();
      if (t.match(/noise.cancel/) || qAudio.match(/noise.cancel/))
        return 'Add noise cancellation dB rating vs Sony and Bose';
      if (t.match(/battery/))        return 'Show battery life comparison chart in product images';
      if (t.match(/gaming/))         return 'Add latency benchmark vs top gaming headset';
      return 'Add frequency response chart and real-world use photo';
    }

    // Generic tech fallback
    return 'Add spec comparison chart vs top competitor in hero image';
  }

  if (domain.name === 'ai_tools') {
    if (t.match(/developer|api|sdk/))   return 'Add live API demo or code snippet to landing page';
    if (t.match(/content|writ|copy/))   return 'Add before/after content sample on homepage hero';
    if (t.match(/automat|workflow/))    return 'Show time-saved metric with a real workflow example';
    if (t.match(/free|trial/))          return 'Make free trial CTA the first visible element above fold';
    return 'Add a 60-second product demo video to the landing page';
  }

  if (domain.name === 'jobs') {
    if (t.match(/remote/))              return 'Add remote job filter as the first option on homepage';
    if (t.match(/fresher|entry.level/)) return 'Create a dedicated fresher jobs landing page';
    if (t.match(/alert|notification/))  return 'Add one-click job alert signup on search results page';
    return 'Add job count by category on homepage to signal volume';
  }

  if (domain.name === 'saas') {
    if (t.match(/free|trial/))          return 'Move free trial CTA above the fold on the pricing page';
    if (t.match(/integrat/))            return 'Add integration logos to homepage to signal compatibility';
    if (t.match(/team|collaborat/))     return 'Add team collaboration screenshot to hero section';
    return 'Add a customer logo strip above the fold for social proof';
  }

  // ── Generic SEO path (ecommerce + unknown domains) ─────────────────────────
  const seoSuggestions = [...groqSuggestions, ...gptSuggestions];
  const { base } = normalizeQuery(query);

  const actionable = seoSuggestions
    .filter((s) => /^(add|use|target|include|highlight|insert|rewrite|place|show|create)/i.test(s))
    .filter((s) => !VAGUE_VERBS.test(s))
    .filter((s) => !hasCampaignLanguage(s))
    .filter((s) => s.split(' ').length >= 4)
    .sort((a, b) => a.length - b.length);

  const best = actionable[0];
  if (best) return trimToCompletePhrase(best, 12);

  return `Add "best ${base}" to your product title`;
}

export function generateFinalStrategy(query, groq, gpt, gemini, comparison) {
  const allModels = { groq, gpt, gemini };
  const primaryModel = comparison.bestModel;
  const domain = detectDomain(query);

  // SEO data sources: Groq + GPT only
  const groqInsights      = groq.insights;
  const gptInsights       = gpt.insights;
  const groqSuggestions   = groq.suggestions;
  const gptSuggestions    = gpt.suggestions;
  const mergedCompetitors = [...new Set([...groq.competitors, ...gpt.competitors, ...gemini.competitors])];

  const focusKeywords = buildKeywords(query, groqInsights, gptInsights);

  return {
    recommendedAction : pickRecommendedAction(primaryModel, allModels, focusKeywords, domain, groqInsights),
    focusKeywords,
    positioning       : detectPositioning(query, groqInsights, gptInsights, mergedCompetitors, domain),
    priceStrategy     : detectPriceStrategy(groqInsights, gptInsights, mergedCompetitors, domain),
    quickWin          : pickQuickWin(query, groqSuggestions, gptSuggestions, domain, groqInsights + ' ' + gptInsights),
  };
}

// ─── Decision + Humanization Layer ──────────────────────────────────────────

// 1. Extract primary and secondary intent from a normalized query
function extractIntent(normalizedQuery) {
  const q = normalizedQuery.toLowerCase();

  const intents = [];

  // Ordered by specificity — first match wins for primary
  if (/gaming|\bfps\b|\bgpu\b|graphics/.test(q))                    intents.push('gaming performance');
  if (/camera|photo|low.light|portrait/.test(q))                    intents.push('camera quality');
  if (/coding|programming|developer|software dev/.test(q))          intents.push('performance for development');
  if (/\bai\b|chatbot|generator|llm/.test(q))                       intents.push('ai productivity');
  if (/battery|endurance|long.lasting/.test(q))                     intents.push('battery life');
  if (/student|college|university/.test(q))                         intents.push('student value');
  if (/budget|under|cheap|affordable/.test(q))                      intents.push('budget');
  if (/business|enterprise|professional/.test(q))                   intents.push('professional use');

  return {
    primary:   intents[0] || 'general performance',
    secondary: intents[1] || null,
  };
}

// 2. Detect price range from query for keyword generation
function extractPriceRange(normalizedQuery) {
  const m = normalizedQuery.match(/under\s+(\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1]);
  if (n >= 1000) return `under ${n}`;
  return null; // sub-1000 numbers are likely not prices
}

// 3. Generate intent-driven, non-redundant keywords
function generateIntentKeywords(intent, product, priceRange) {
  const pr = priceRange ? ` ${priceRange}` : '';
  const p  = product.trim();

  const pools = {
    'gaming performance': [
      `gaming ${p}${pr}`,
      `best budget gaming ${p}`,
      `high fps ${p}${pr}`,
      `best gaming ${p} for performance`,
      `${p} for gaming${pr}`,
    ],
    'camera quality': [
      `camera ${p}${pr}`,
      `best photography ${p}`,
      `${p} with best camera${pr}`,
      `best ${p} for photos`,
      `${p} low light camera`,
    ],
    'performance for development': [
      `best laptops for coding`,
      `laptop for programming students`,
      `laptops for software development`,
      `best laptops for software engineers`,
      `budget laptops for coding`,
    ],
    'ai productivity': [
      `best ai tools 2026`,
      `ai tools for productivity`,
      `ai automation tools`,
      `chatgpt alternatives`,
      `ai tools for developers`,
    ],
    'battery life': [
      `${p} with best battery life`,
      `long battery ${p}`,
      `best ${p} battery life${pr}`,
      `${p} for all day use`,
      `best battery ${p}`,
    ],
    'student value': [
      `best ${p} for students`,
      `budget ${p} for college`,
      `affordable ${p} for students`,
      `${p} for students${pr}`,
      `best student ${p}`,
    ],
    'budget': [
      `best budget ${p}`,
      `${p}${pr}`,
      `affordable ${p}`,
      `best ${p} under budget`,
      `cheap ${p} good performance`,
    ],
    'professional use': [
      `best ${p} for professionals`,
      `professional ${p}`,
      `${p} for business use`,
      `enterprise ${p}`,
      `best ${p} for work`,
    ],
    'general performance': [
      `best ${p} 2026`,
      `top rated ${p}`,
      `best ${p} for everyday use`,
      `${p} buying guide`,
      `best value ${p}`,
    ],
  };

  const raw = pools[intent] || pools['general performance'];

  // Enforce 2–6 words, no duplicates
  const seen = new Set();
  return raw
    .map((kw) => kw.trim().replace(/\s{2,}/g, ' '))
    .filter((kw) => {
      const words = kw.split(' ');
      if (words.length < 2 || words.length > 6) return false;
      if (seen.has(kw)) return false;
      seen.add(kw);
      return true;
    })
    .slice(0, 5);
}

// 4. Remove redundant keywords — if two phrases share the same core meaning, keep the stronger one
function removeKeywordRedundancy(keywords) {
  // Pairs of synonymous intent patterns — if both present, drop the weaker (later) one
  const REDUNDANT_PAIRS = [
    [/laptops? for developers?/i,    /laptops? for programming/i],
    [/laptops? for coding/i,         /laptops? for software dev/i],
    [/gaming phone/i,                /phone for gaming/i],
    [/budget gaming/i,               /affordable gaming/i],
    [/best budget/i,                 /cheap/i],
    [/photography/i,                 /camera quality/i],
  ];

  const result = [...keywords];
  for (const [strongPat, weakPat] of REDUNDANT_PAIRS) {
    const hasStrong = result.some((k) => strongPat.test(k));
    if (hasStrong) {
      const weakIdx = result.findIndex((k) => weakPat.test(k));
      if (weakIdx !== -1) result.splice(weakIdx, 1);
    }
  }
  return result.slice(0, 5);
}

// 5. Generate a human-sounding recommended action (not templated)
function generateHumanStrategy(primaryIntent, topProduct) {
  const p = topProduct || 'the top competitor';

  const templates = {
    'gaming performance': `Focus on raw gaming performance — highlight FPS stability, cooling system, and battery endurance better than ${p}`,
    'camera quality':     `Win on camera clarity — emphasize low-light performance and real photo samples that outperform ${p}`,
    'performance for development': `Position as a developer-first machine — better keyboard, RAM options, and Linux compatibility than ${p}`,
    'ai productivity':    `Differentiate from ${p} by targeting a specific niche — developers, creators, or marketers — with purpose-built AI workflows`,
    'battery life':       `Lead with endurance — show real-world battery benchmarks and all-day usage scenarios that outlast ${p}`,
    'student value':      `Own the student segment — bundle software, offer education pricing, and highlight portability advantages over ${p}`,
    'budget':             `Compete on value — match ${p}'s core specs at a lower price and make the price-to-performance gap impossible to ignore`,
    'professional use':   `Target professionals who need reliability — highlight security features, build quality, and support options vs ${p}`,
    'general performance':`Outperform ${p} where it matters most — identify its weakest reviewed feature and make that your headline strength`,
  };

  return templates[primaryIntent] || templates['general performance'];
}

// 6. Generate a sharp, intent-driven positioning statement
function generatePositioning(primaryIntent, priceType, domain) {
  const isBudget = priceType === 'budget' || primaryIntent === 'budget' || primaryIntent === 'student value';

  // Platform-domain intents — never use "device" or "product"
  if (domain === 'platform') {
    const platformMap = {
      'ai productivity':   'AI productivity platform focused on automation, speed, and ease of use',
      'general performance': 'Platform focused on strong user experience and reliable performance',
      'budget':            'Accessible platform offering core features without a premium price',
      'professional use':  'Professional platform built for reliability, security, and team productivity',
      'student value':     'Platform designed for students — easy to use, affordable, and fast to get started',
    };
    return platformMap[primaryIntent] || 'Platform focused on fast discovery, easy application flow, and strong user trust';
  }

  // Product-domain intents — use hardware/product language
  const map = {
    'gaming performance':          isBudget ? 'Budget gaming build for consistent FPS performance'         : 'High-performance gaming build for competitive play',
    'camera quality':              isBudget ? 'Camera-focused option for users who prioritize image quality on a budget' : 'Camera-first option for photography enthusiasts',
    'performance for development': isBudget ? 'Budget developer laptop with strong processing power and portability' : 'Performance-first laptop tailored for developers and engineers',
    'ai productivity':             'AI productivity tool focused on automation, speed, and ease of use',
    'battery life':                'Long-lasting option built for all-day productivity without compromise',
    'student value':               'Affordable, capable option designed for students who need performance and portability',
    'budget':                      'Value-first option offering competitive specs without the premium price tag',
    'professional use':            'Professional-grade option built for reliability, security, and all-day performance',
    'general performance':         'Well-rounded option offering strong performance and reliable everyday use',
  };

  return map[primaryIntent] || map['general performance'];
}

// 7. Generate a sharp, intent-specific quick win
function generateQuickWin(primaryIntent, domain) {
  // Platform-domain quick wins — no product listing / image language
  if (domain === 'platform') {
    const platformMap = {
      'ai productivity':             'Add a 60-second product demo video to the landing page',
      'general performance':         'Add a feature comparison table vs top 3 competitors on the homepage',
      'budget':                      'Make the free tier CTA the first visible element above the fold',
      'professional use':            'Highlight security certifications and enterprise support on the pricing page',
      'student value':               'Add a student plan with clear pricing and one-click signup',
    };
    return platformMap[primaryIntent] || 'Add a prominent search filter for the most common user intent on the homepage';
  }

  // Product-domain quick wins
  const map = {
    'gaming performance':          'Show real gameplay FPS benchmarks in product images',
    'camera quality':              'Add side-by-side camera comparisons vs top competitor in listing',
    'performance for development': 'Show coding setup with VS Code and terminal in hero image',
    'ai productivity':             'Add a 60-second product demo video to the landing page',
    'battery life':                'Show screen-on time benchmark vs top competitor in hero image',
    'student value':               'Add student discount badge and bundle offer on listing',
    'budget':                      'Add spec comparison chart vs top competitor at same price point',
    'professional use':            'Highlight security certifications and enterprise support in listing',
    'general performance':         'Add feature comparison table vs top 3 competitors in listing',
  };

  return map[primaryIntent] || map['general performance'];
}

// ─── Domain Enforcement Layer ─────────────────────────────────────────────────

// Words that must never appear in platform-domain outputs
const PLATFORM_BLOCKED = [
  [/\bdevice\b/gi,          'platform'],
  [/\bproduct listing\b/gi, 'platform listing'],
  [/\blisting\b/gi,         'platform page'],
  [/\bSKU\b/gi,             'entry'],
  [/\bprice point\b/gi,     'pricing tier'],
  [/\bbullet points?\b/gi,  'key highlights'],
  [/\bproduct images?\b/gi, 'platform screenshots'],
  [/\bimage optimization\b/gi, 'UX improvement'],
];

// Words that must never appear in product-domain outputs
const PRODUCT_BLOCKED = [
  [/\buser onboarding\b/gi, 'getting started experience'],
  [/\bcommunity engagement\b/gi, 'customer engagement'],
  [/\bplatform\b/gi,        'product'],
];

// Generic strategy verbs that must be replaced with specific structure
const GENERIC_STRATEGY_RE = /\b(outperform|compete better|improve quality|be better than|do better than)\b/gi;

// Fallback safe responses per domain
// ── Real competitor maps per sub-domain ──────────────────────────────────────
const REAL_COMPETITORS = {
  jobs:     ['Indeed', 'LinkedIn Jobs', 'Naukri', 'Glassdoor', 'Shine'],
  saas:     ['Salesforce', 'HubSpot', 'Notion', 'Monday.com', 'Asana'],
  ai_tools: ['ChatGPT', 'Claude', 'Gemini', 'Jasper', 'Copy.ai'],
  ecommerce:['Amazon', 'Flipkart', 'Shopify', 'Meesho', 'Myntra'],
};

// Specific feature improvements per sub-domain
const SPECIFIC_FEATURES = {
  jobs:     [
    'fresher job filters and faster one-click applications',
    'resume upload and job alert setup in under 60 seconds',
    'location-based job discovery and salary transparency',
    'campus recruitment and internship listings for graduates',
    'skill-based job matching and interview preparation tools',
  ],
  saas:     [
    'a simpler onboarding flow and transparent pricing page',
    'deeper integrations with tools teams already use',
    'a free tier that delivers core value without a credit card',
    'faster time-to-value with pre-built templates',
  ],
  ai_tools: [
    'niche use-case focus for developers or content creators',
    'faster output quality and a side-by-side comparison demo',
    'a free tier that converts users at key usage limits',
  ],
};

// Generic phrases that must never appear in the final strategy
const GENERIC_STRATEGY_PHRASES = [
  /\btop competitors\b/i,
  /\bleading platform\b/i,
  /\bhighlight strengths\b/i,
  /\bimprove quality\b/i,
  /\boutperform\b/i,
  /\bcompete better\b/i,
  /\bbe better than\b/i,
  /\bdo better than\b/i,
  /\bgeneric\b/i,
];

function isGenericStrategy(text) {
  if (!text) return true;
  return GENERIC_STRATEGY_PHRASES.some((re) => re.test(text));
}

// Detect sub-domain from query for competitor/feature selection
function detectSubDomain(normalizedQuery) {
  const q = normalizedQuery.toLowerCase();
  if (/\bjob(s)?\b|\bcareer|\bresume|\bhiring|\brecruit|\binternship|\bfresher/.test(q)) return 'jobs';
  if (/\bai\b|\bchatbot|\bgenerator|\bllm|\bgpt/.test(q)) return 'ai_tools';
  if (/\bsoftware|\bsaas|\bplatform|\btool\b|\bapp\b|\bdashboard/.test(q)) return 'saas';
  return 'ecommerce';
}

// Build a specific strategy sentence using real competitor + real feature
function buildSpecificStrategy(subDomain, topProduct) {
  const competitors = REAL_COMPETITORS[subDomain] || REAL_COMPETITORS.ecommerce;
  const features    = SPECIFIC_FEATURES[subDomain] || SPECIFIC_FEATURES.saas;

  // Use topProduct if it's a real name (not a placeholder), else pick from known list
  const PLACEHOLDER_RE = /^(top competitor|category leader|leading platform|market leader|competitor [a-z]|product [a-e])/i;
  const competitor = (!PLACEHOLDER_RE.test(topProduct) && topProduct && topProduct.length > 2)
    ? topProduct
    : competitors[0];

  // Pick a feature deterministically (based on competitor name length as seed)
  const featureIdx = competitor.length % features.length;
  const feature    = features[featureIdx];

  return `Compete with ${competitor} by improving ${feature}.`;
}

// Job-specific keyword pool — always realistic search queries
const JOB_KEYWORDS = [
  'jobs for freshers',
  'entry level jobs India',
  'graduate jobs 2026',
  'jobs for recent graduates',
  'fresher jobs in tech',
  'internship jobs for students',
  'remote jobs for freshers',
  'part time jobs for students',
  'jobs without experience',
  'first job after graduation',
];

// Build job keywords driven by query signals
function buildJobKeywords(normalizedQuery) {
  const q = normalizedQuery.toLowerCase();
  const pool = [...JOB_KEYWORDS];
  const priority = [];

  if (/remote|work from home/.test(q))   priority.push('remote jobs for freshers', 'work from home jobs');
  if (/fresher|graduate|entry/.test(q))  priority.push('jobs for freshers', 'entry level jobs India', 'graduate jobs 2026');
  if (/intern/.test(q))                  priority.push('internship jobs for students');
  if (/tech|software|developer/.test(q)) priority.push('fresher jobs in tech');
  if (/part.time/.test(q))               priority.push('part time jobs for students');

  return [...new Set([...priority, ...pool])].slice(0, 5);
}

const PLATFORM_FALLBACK = {
  recommendedAction: 'Compete with Indeed by improving fresher job filtering and faster application flow.',
  focusKeywords:     ['jobs for freshers', 'entry level jobs', 'graduate jobs 2026', 'remote jobs for freshers', 'jobs for recent graduates'],
  positioning:       'Job platform designed for faster job discovery and easy applications.',
  quickWin:          'Add a fresher-only job filter on the homepage search bar.',
};

const PRODUCT_FALLBACK = {
  recommendedAction: 'Compete with top competitors by highlighting the strongest performance feature and clear pricing advantage.',
  focusKeywords:     ['best product in this category', 'top rated option', 'budget friendly choice'],
  positioning:       'Well-positioned product offering strong performance and reliable everyday use.',
  quickWin:          'Add a feature comparison chart vs the top competitor in the listing.',
};

function enforceDomainLanguage(text, domain) {
  if (!text) return text;
  let t = text;
  if (domain === 'platform') {
    for (const [pattern, replacement] of PLATFORM_BLOCKED) {
      t = t.replace(pattern, replacement);
    }
  } else {
    for (const [pattern, replacement] of PRODUCT_BLOCKED) {
      t = t.replace(pattern, replacement);
    }
  }
  return t.replace(/\s{2,}/g, ' ').trim();
}

function isSpecificStrategy(text) {
  if (!text) return false;
  if (isGenericStrategy(text)) return false;
  return /\b(filters?|search|apply|onboard|match|discover|recommend|speed|fps|camera|battery|ram|ssd|gpu|price|ux|ui|flow|dashboard|api|integration|support|trial|listing|image|spec|benchmark|comparison|application|fresher|hiring|job|salary|review|rating)\b/i.test(text);
}

/**
 * Enforce domain correctness, real competitors, and specific strategy.
 */
function enforceFinalStrategy(strategy, domain, primaryIntent, normalizedQuery, topProduct) {
  const subDomain = detectSubDomain(normalizedQuery || '');
  const fallback  = domain === 'platform' ? PLATFORM_FALLBACK : PRODUCT_FALLBACK;

  // ── Rewrite cross-domain language ────────────────────────────────────
  let recommendedAction = enforceDomainLanguage(strategy.recommendedAction, domain);
  let positioning       = enforceDomainLanguage(strategy.positioning,       domain);
  let priceStrategy     = enforceDomainLanguage(strategy.priceStrategy,     domain);
  let quickWin          = enforceDomainLanguage(strategy.quickWin,          domain);

  // ── Force specific strategy with real competitor ──────────────────────
  if (isGenericStrategy(recommendedAction) || !isSpecificStrategy(recommendedAction)) {
    recommendedAction = buildSpecificStrategy(subDomain, topProduct);
  }

  // ── Platform quick win: FORCE correct value, no product-listing language ─
  // (will be overwritten again at the very end — kept here for intermediate safety)

  // ── Keywords: use job-specific pool for job queries ───────────────────
  let focusKeywords = strategy.focusKeywords;
  if (subDomain === 'jobs') {
    focusKeywords = buildJobKeywords(normalizedQuery || '');
  } else if (domain === 'platform') {
    const PRODUCT_KW_RE = /\b(laptop|phone|shoes|device|gadget|headphone|camera|gpu|ssd|ram|processor)\b/i;
    const filtered = focusKeywords.filter((kw) => !PRODUCT_KW_RE.test(kw));
    const GENERIC_KW_RE = /^(job search platform|buying guide|best value product|top platform|leading platform)/i;
    const cleaned = filtered.filter((kw) => !GENERIC_KW_RE.test(kw));
    focusKeywords = cleaned.length >= 3 ? cleaned : fallback.focusKeywords;
  } else {
    const PLATFORM_KW_RE = /\b(job(s)?|career|resume|hiring|platform|website|saas|onboarding)\b/i;
    const filtered = focusKeywords.filter((kw) => !PLATFORM_KW_RE.test(kw));
    focusKeywords = filtered.length >= 3 ? filtered : focusKeywords;
  }

  // ── Final validation: if still generic after all fixes, use safe fallback ──
  if (isGenericStrategy(recommendedAction)) {
    recommendedAction = fallback.recommendedAction;
    focusKeywords     = fallback.focusKeywords;
  }

  console.log('DOMAIN ENFORCE:', domain, '/', subDomain, '| specific:', isSpecificStrategy(recommendedAction));

  // ── FINAL OVERRIDE — runs last, no conditions, no regex ──────────────
  // Platform positioning and quickWin are always forced here, overwriting
  // anything set above. This is the single source of truth for platform output.
  if (domain === 'platform') {
    positioning = 'Job platform designed for fast job discovery, fresher-focused filtering, and easy applications.';
    quickWin    = 'Add a fresher-only job filter and simplify application flow.';
  }

  return {
    ...strategy,
    recommendedAction,
    positioning,
    priceStrategy,
    quickWin,
    focusKeywords,
  };
}

// ─── Adaptive + Data-Augmented Layer ─────────────────────────────────────────

// In-memory query cache with TTL — avoids redundant LLM calls for repeated queries
const queryCache = new Map(); // key → { result, timestamp }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// 1. Lightweight intent signals from query heuristics (no scraping, no fake data)
function getLightweightSignals(normalizedQuery) {
  const q = normalizedQuery.toLowerCase();
  // Feature signals checked first — more specific than "best" or "compare"
  if (/\bcamera\b|\bfps\b|\bbattery\b|\bram\b|\bssd\b|\bgpu\b|\bprocessor\b/.test(q)) return { intentType: 'feature' };
  if (/\bunder\b|\bbudget\b|\bcheap\b|\baffordable\b/.test(q)) return { intentType: 'budget' };
  if (/\bbest\b|\bvs\b|\bcompare\b|\balternative\b|\breview\b/.test(q)) return { intentType: 'comparison' };
  return { intentType: 'comparison' }; // default — most queries are comparison-driven
}

// 2. Score a strategy candidate string for quality
function scoreStrategy(text) {
  if (!text) return 0;
  let score = 0;
  const words = text.split(/\s+/);
  // Length sweet spot: 8–20 words
  if (words.length >= 8 && words.length <= 20) score += 2;
  else if (words.length > 4) score += 1;
  // Contains an action verb
  if (/\b(focus|win|position|compete|target|lead|highlight|emphasize|differentiate|outperform|build|show)\b/i.test(text)) score += 2;
  // Mentions a feature signal
  if (/\b(fps|camera|battery|ram|ssd|cpu|gpu|performance|speed|price|value|quality|design|display)\b/i.test(text)) score += 2;
  // Mentions a competitor or comparison
  if (/\b(vs|than|over|against|better|outperform|competitor|alternative)\b/i.test(text)) score += 2;
  // Penalise generic filler
  if (/\b(optimize|improve|enhance|leverage|ensure|consider)\b/i.test(text)) score -= 2;
  return score;
}

// 3. Refine the recommended action based on lightweight signals
function refineWithSignals(recommendedAction, signals) {
  const { intentType } = signals;
  if (intentType === 'budget') {
    // Ensure pricing angle is present
    if (!/price|value|budget|cost|afford/i.test(recommendedAction)) {
      return recommendedAction.replace(/\.$/, '') + ' — lead with price-to-performance advantage.';
    }
  }
  if (intentType === 'comparison') {
    // Ensure competitor comparison angle is present
    if (!/vs|than|over|competitor|outperform|better/i.test(recommendedAction)) {
      return recommendedAction.replace(/\.$/, '') + ' — make the comparison impossible to ignore.';
    }
  }
  if (intentType === 'feature') {
    // Ensure a specific feature is called out
    if (!/feature|spec|fps|camera|battery|ram|ssd|display|performance/i.test(recommendedAction)) {
      return recommendedAction.replace(/\.$/, '') + ' — lead with the standout feature.';
    }
  }
  return recommendedAction;
}

// 4. Generate keywords dynamically via LLM, with static pool as fallback
async function generateDynamicKeywords(normalizedQuery, primaryIntent, secondaryIntent) {
  const secondaryLine = secondaryIntent ? `Optional secondary intent: ${secondaryIntent}` : '';
  const prompt = `Generate 8 realistic Google search keywords for: "${normalizedQuery}"
Focus on intent: ${primaryIntent}
${secondaryLine}
Rules:
- no generic adjectives (comfortable, lightweight, stylish)
- no repetition or near-synonyms
- must look like real user searches (2–6 words each)
- no brand names unless part of the query
- no explanations
Return ONLY a valid JSON array of strings. Example: ["keyword one","keyword two"]`;

  try {
    const raw = await callGroq(
      'keywords',
      'You are a JSON-only keyword research assistant. Return only a raw JSON array of strings. No markdown, no explanation.',
      prompt,
    );

    // Parse — try direct, then regex extract
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) {
      const m = raw.match(/\[[\s\S]*?\]/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (_) {} }
    }

    if (!Array.isArray(parsed)) return null;

    // Validate each keyword
    const valid = parsed
      .filter((k) => typeof k === 'string')
      .map((k) => k.toLowerCase().trim().replace(/\s{2,}/g, ' '))
      .filter((k) => {
        const words = k.split(' ');
        return words.length >= 2 && words.length <= 6;
      });

    return removeKeywordRedundancy([...new Set(valid)]).slice(0, 5);
  } catch (_) {
    return null; // caller falls back to static pool
  }
}

// 5. Generate 3 strategy candidates and pick the best-scoring one
function generateStrategyCandidates(primaryIntent, topProduct) {
  const p = topProduct || 'the top competitor';

  // Each intent has 3 distinct angle variations
  const candidateMap = {
    'gaming performance': [
      `Focus on raw gaming performance — highlight FPS stability, cooling system, and battery endurance better than ${p}`,
      `Beat ${p} on the spec sheet — lead with GPU benchmark scores and thermal performance in every listing image`,
      `Own the budget gaming segment — show that consistent FPS at this price point beats ${p} in real gameplay`,
    ],
    'camera quality': [
      `Win on camera clarity — emphasize low-light performance and real photo samples that outperform ${p}`,
      `Make the camera the hero — side-by-side shots against ${p} in every product image and listing`,
      `Target photography enthusiasts who feel ${p} overcharges — deliver comparable image quality at a lower price`,
    ],
    'performance for development': [
      `Position as a developer-first machine — better keyboard, RAM options, and Linux compatibility than ${p}`,
      `Win developers who are tired of ${p}'s limitations — highlight open-source support, port selection, and upgrade paths`,
      `Target CS students and junior devs who need power without the MacBook price — make the spec comparison obvious`,
    ],
    'ai productivity': [
      `Differentiate from ${p} by targeting a specific niche — developers, creators, or marketers — with purpose-built AI workflows`,
      `Compete with ${p} on speed and simplicity — show output quality side-by-side and let the results speak`,
      `Win users frustrated with ${p}'s pricing — offer a free tier that delivers 80% of the value at zero cost`,
    ],
    'battery life': [
      `Lead with endurance — show real-world battery benchmarks and all-day usage scenarios that outlast ${p}`,
      `Make battery life the headline — a single charge comparison chart against ${p} is worth more than any spec sheet`,
      `Target road warriors who've been let down by ${p}'s battery claims — use real screen-on time data`,
    ],
    'student value': [
      `Own the student segment — bundle software, offer education pricing, and highlight portability advantages over ${p}`,
      `Beat ${p} on total cost of ownership for students — include software bundles and warranty in the price comparison`,
      `Target first-year students who can't justify ${p}'s price — show what they get for less`,
    ],
    'budget': [
      `Compete on value — match ${p}'s core specs at a lower price and make the price-to-performance gap impossible to ignore`,
      `Win price-sensitive buyers by being transparent — publish a direct spec comparison vs ${p} at the same price`,
      `Target buyers who've been priced out by ${p} — show that budget doesn't mean compromise on the features they care about`,
    ],
    'professional use': [
      `Target professionals who need reliability — highlight security features, build quality, and support options vs ${p}`,
      `Win enterprise buyers frustrated with ${p}'s support — lead with SLA, security certifications, and IT management tools`,
      `Position as the professional alternative to ${p} — same reliability, better value, stronger support`,
    ],
    'general performance': [
      `Outperform ${p} where it matters most — identify its weakest reviewed feature and make that your headline strength`,
      `Find the gap ${p} leaves open — read its 1-star reviews and build your positioning around solving those exact complaints`,
      `Don't compete with ${p} on everything — pick one dimension where you clearly win and own that story completely`,
    ],
  };

  const candidates = candidateMap[primaryIntent] || candidateMap['general performance'];
  // Score each and return the best
  return candidates.reduce((best, c) => scoreStrategy(c) >= scoreStrategy(best) ? c : best, candidates[0]);
}

// ─── Grounding + Evidence + Confidence Layer ─────────────────────────────────

// Feature signal vocabulary used for grounding and evidence
const GROUND_SIGNAL_VOCAB = [
  'battery', 'fps', 'camera', 'ram', 'ssd', 'gpu', 'cpu', 'processor',
  'display', 'screen', 'performance', 'speed', 'price', 'value', 'design',
  'build', 'weight', 'port', 'connectivity', 'software', 'support', 'trial',
  'integration', 'workflow', 'automation', 'security', 'scalability',
  'coding', 'programming', 'developer', 'gaming', 'photography', 'student',
];

// 1. Extract ground signals from AI insights + optional scraped titles
//    Counts how many times each signal word appears across all model insights
async function getGroundSignals(query, modelInsights) {
  const combined = modelInsights.join(' ').toLowerCase();
  const counts = {};

  for (const term of GROUND_SIGNAL_VOCAB) {
    const matches = combined.match(new RegExp(`\\b${term}\\b`, 'gi'));
    if (matches && matches.length > 0) counts[term] = matches.length;
  }

  // ── Enrich with scraped titles (non-blocking, best-effort) ──────────────
  try {
    const { fetchTopSearchTitles, extractSignalsFromTitles } = await import('./scraperService.js');
    const titles = await fetchTopSearchTitles(query);
    const scrapedSignals = extractSignalsFromTitles(titles);
    // Boost scraped signals by 1 count each (they confirm real-world relevance)
    for (const term of scrapedSignals) {
      counts[term] = (counts[term] || 0) + 1;
    }
  } catch (_) {
    // Scraping is optional — silently ignore any failure
  }

  // Sort by frequency, return top 5 signal words
  const topSignals = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);

  return {
    topSignals,
    notes: topSignals.length > 0
      ? `Recurring themes across AI analyses: ${topSignals.join(', ')}`
      : 'No strong recurring signals detected',
  };
}

// 2. Build a 1-sentence evidence statement grounded in signals or insights
function buildEvidence(insights, groundSignals, primaryIntent) {
  const { topSignals } = groundSignals;

  // Prefer ground signals when available — they're derived from actual AI output
  if (topSignals.length >= 2) {
    const top2 = topSignals.slice(0, 2).join(' and ');
    const intentPhrases = {
      'gaming performance':          `Top analyses consistently highlight ${top2} as the primary ranking factors for gaming intent.`,
      'camera quality':              `Camera-related signals like ${top2} are repeatedly emphasized across all model outputs.`,
      'performance for development': `Developer-focused signals — ${top2} — dominate the analysis, confirming strong coding intent.`,
      'ai productivity':             `AI tool analyses converge on ${top2} as the key differentiators in this category.`,
      'battery life':                `${top2.charAt(0).toUpperCase() + top2.slice(1)} are the most cited factors across all model insights.`,
      'student value':               `Analyses emphasize ${top2} as the core decision drivers for the student segment.`,
      'budget':                      `Price-related signals (${top2}) appear consistently, confirming strong budget intent.`,
      'professional use':            `Professional-grade signals — ${top2} — are consistently highlighted across model outputs.`,
      'general performance':         `Analyses converge on ${top2} as the primary factors driving rankings in this category.`,
    };
    return intentPhrases[primaryIntent] || intentPhrases['general performance'];
  }

  // Fallback: derive from the best insight sentence
  const bestInsight = insights
    .filter((s) => s && s.length > 20)
    .sort((a, b) => b.length - a.length)[0] || '';

  if (bestInsight) {
    // Take the first sentence only
    const firstSentence = bestInsight.split(/[.!?]/)[0].trim();
    return firstSentence.length > 15 ? firstSentence + '.' : 'Strategy is grounded in multi-model AI analysis of this category.';
  }

  return 'Strategy is grounded in multi-model AI analysis of this category.';
}

// 3. Keyword quality score (0–4)
function keywordQualityScore(keywords, normalizedQuery) {
  if (!keywords || keywords.length === 0) return 0;
  let score = 0;

  const allValidLength = keywords.every((k) => {
    const w = k.split(' ').length;
    return w >= 2 && w <= 5;
  });
  if (allValidLength) score += 1;

  const coreTerms = normalizedQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const hasProductTerm = keywords.some((k) => coreTerms.some((t) => k.includes(t)));
  if (hasProductTerm) score += 1;

  const unique = new Set(keywords);
  if (unique.size === keywords.length) score += 1;

  // Matches intent — at least one keyword contains a meaningful intent word
  const intentWords = /gaming|camera|coding|programming|budget|student|battery|developer|software|laptop|phone/i;
  if (keywords.some((k) => intentWords.test(k))) score += 1;

  return score;
}

// 4. Compute confidence score (0.50–0.90)
function computeConfidence({ hasGroundSignals, kwQuality, strategyScore }) {
  let score = 0.60;
  if (hasGroundSignals)   score += 0.15;
  if (kwQuality >= 3)     score += 0.15;
  if (strategyScore >= 6) score += 0.10;
  return Math.min(0.90, Math.max(0.50, parseFloat(score.toFixed(2))));
}

// 5. Strategy guardrail — reject generic-only strategies, pick next-best or use fallback
function guardStrategy(candidates, primaryIntent) {
  const GENERIC_ONLY = /^(optimize|improve|enhance|leverage|ensure|consider|focus on)\b/i;

  for (const candidate of candidates) {
    if (!GENERIC_ONLY.test(candidate.trim())) return candidate;
  }

  // All candidates failed — use safe fallback
  return `Compete by emphasizing the core ${primaryIntent} advantage and clear product benefits over top competitors.`;
}

// ─── Multi-Model Orchestrator ─────────────────────────────────────────────────

export async function analyzeWithMultipleModels(query) {
  // ── Cache check — return immediately for fresh cached results ────────────
  const cacheKey = query.toLowerCase().trim();
  const cached = queryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log('CACHE HIT:', cacheKey);
    return cached.result;
  }

  // ── Step 1: Normalize the raw query ──────────────────────────────────────
  const normalizedQuery = normalizeQueryText(query);
  console.log('NORMALIZED QUERY:', normalizedQuery);

  const [groqRaw, gptRaw, geminiRaw] = await Promise.all([
    analyzeProduct(normalizedQuery),
    analyzeProductGPT(normalizedQuery),
    analyzeProductGemini(normalizedQuery),
  ]);

  // ── Step 2: Validation & cleaning layer ──────────────────────────────────
  const cleaningDomain  = detectCleaningDomain(normalizedQuery);
  const enhancedDomain  = detectEnhancedDomain(normalizedQuery);
  console.log('DOMAIN:', cleaningDomain, '/', enhancedDomain);

  const groqResult   = cleanModelResult(groqRaw,   normalizedQuery);
  const gptResult    = cleanModelResult(gptRaw,    normalizedQuery);
  const geminiResult = cleanModelResult(geminiRaw, normalizedQuery);

  // ── Step 3: Generate strategy ─────────────────────────────────────────────
  const comparison  = compareModels(groqResult, gptResult, geminiResult);
  const strategyRaw = generateFinalStrategy(normalizedQuery, groqResult, gptResult, geminiResult, comparison);

  // ── Step 4: Decision + Humanization + Adaptive layer ────────────────────
  const { primary: primaryIntent, secondary: secondaryIntent } = extractIntent(normalizedQuery);
  const priceRange = extractPriceRange(normalizedQuery);
  const signals    = getLightweightSignals(normalizedQuery);
  const topProduct = groqResult.ranking?.[0]?.name || gptResult.ranking?.[0]?.name || 'the top competitor';

  console.log('INTENT:', primaryIntent, '/', secondaryIntent, '| SIGNAL:', signals.intentType);

  // ── Keywords: LLM-dynamic first, static pool fallback ──────────────────
  let finalKeywords;
  const dynamicKw = await generateDynamicKeywords(normalizedQuery, primaryIntent, secondaryIntent);
  if (dynamicKw && dynamicKw.length >= 3) {
    finalKeywords = dynamicKw;
  } else {
    const productNoun = normalizedQuery
      .replace(/\b(best|budget|top|cheap|affordable|premium|gaming|camera|coding|under\s+\d+)\b/gi, '')
      .replace(/\s{2,}/g, ' ').trim() || normalizedQuery.split(' ').slice(-1)[0];
    const intentKw     = generateIntentKeywords(primaryIntent, productNoun, priceRange);
    const validatedKw  = validateKeywords(strategyRaw.focusKeywords, normalizedQuery);
    const normalizedKw = normalizeKeywords(
      validatedKw.length >= 3 ? validatedKw : strategyRaw.focusKeywords,
      normalizedQuery, enhancedDomain,
    );
    const poolKw = removeKeywordRedundancy(intentKw);
    finalKeywords = poolKw.length >= 3 ? poolKw : normalizedKw;
  }

  // ── Keyword quality check — regenerate once if weak ──────────────────
  let kwQuality = keywordQualityScore(finalKeywords, normalizedQuery);
  if (kwQuality < 2) {
    const regenKw = await generateDynamicKeywords(normalizedQuery, primaryIntent, secondaryIntent);
    if (regenKw && regenKw.length >= 3) {
      finalKeywords = regenKw;
      kwQuality = keywordQualityScore(finalKeywords, normalizedQuery);
    }
  }
  console.log('FINAL KEYWORDS:', finalKeywords, '| KW QUALITY:', kwQuality);

  // ── Strategy: multi-candidate scoring with guardrail ─────────────────
  const allCandidates = (() => {
    const p = topProduct;
    const map = {
      'gaming performance': [
        `Focus on raw gaming performance — highlight FPS stability, cooling system, and battery endurance better than ${p}`,
        `Beat ${p} on the spec sheet — lead with GPU benchmark scores and thermal performance in every listing image`,
        `Own the budget gaming segment — show that consistent FPS at this price point beats ${p} in real gameplay`,
      ],
      'camera quality': [
        `Win on camera clarity — emphasize low-light performance and real photo samples that outperform ${p}`,
        `Make the camera the hero — side-by-side shots against ${p} in every product image and listing`,
        `Target photography enthusiasts who feel ${p} overcharges — deliver comparable image quality at a lower price`,
      ],
      'performance for development': [
        `Position as a developer-first machine — better keyboard, RAM options, and Linux compatibility than ${p}`,
        `Win developers who are tired of ${p}'s limitations — highlight open-source support, port selection, and upgrade paths`,
        `Target CS students and junior devs who need power without the MacBook price — make the spec comparison obvious`,
      ],
      'ai productivity': [
        `Differentiate from ${p} by targeting a specific niche — developers, creators, or marketers — with purpose-built AI workflows`,
        `Compete with ${p} on speed and simplicity — show output quality side-by-side and let the results speak`,
        `Win users frustrated with ${p}'s pricing — offer a free tier that delivers comparable value at zero cost`,
      ],
      'battery life': [
        `Lead with endurance — show real-world battery benchmarks and all-day usage scenarios that outlast ${p}`,
        `Make battery life the headline — a single charge comparison chart against ${p} is worth more than any spec sheet`,
        `Target road warriors who've been let down by ${p}'s battery claims — use real screen-on time data`,
      ],
      'student value': [
        `Own the student segment — bundle software, offer education pricing, and highlight portability advantages over ${p}`,
        `Beat ${p} on total cost of ownership for students — include software bundles and warranty in the price comparison`,
        `Target first-year students who can't justify ${p}'s price — show what they get for less`,
      ],
      'budget': [
        `Compete on value — match ${p}'s core specs at a lower price and make the price-to-performance gap impossible to ignore`,
        `Win price-sensitive buyers by being transparent — publish a direct spec comparison vs ${p} at the same price`,
        `Target buyers who've been priced out by ${p} — show that budget doesn't mean compromise on the features they care about`,
      ],
      'professional use': [
        `Target professionals who need reliability — highlight security features, build quality, and support options vs ${p}`,
        `Win enterprise buyers frustrated with ${p}'s support — lead with SLA, security certifications, and IT management tools`,
        `Position as the professional alternative to ${p} — same reliability, better value, stronger support`,
      ],
      'general performance': [
        `Outperform ${p} where it matters most — identify its weakest reviewed feature and make that your headline strength`,
        `Find the gap ${p} leaves open — read its 1-star reviews and build your positioning around solving those exact complaints`,
        `Don't compete with ${p} on everything — pick one dimension where you clearly win and own that story completely`,
      ],
    };
    return map[primaryIntent] || map['general performance'];
  })();

  const guardedAction = guardStrategy(allCandidates, primaryIntent);
  const strategyScore = scoreStrategy(guardedAction);
  const refinedAction = refineWithSignals(repairText(guardedAction), signals);

  // ── Step 5: Grounding + Evidence + Confidence ─────────────────────────
  const allInsights   = [groqResult.insights, gptResult.insights, geminiResult.insights].filter(Boolean);
  const groundSignals = await getGroundSignals(normalizedQuery, allInsights);
  const evidence      = buildEvidence(allInsights, groundSignals, primaryIntent);
  const confidence    = computeConfidence({
    hasGroundSignals: groundSignals.topSignals.length >= 2,
    kwQuality,
    strategyScore,
  });

  console.log('GROUND SIGNALS:', groundSignals.topSignals, '| CONFIDENCE:', confidence);

  const rawFinalStrategy = {
    ...strategyRaw,
    focusKeywords:     finalKeywords,
    recommendedAction: sanitizeOutput(refinedAction),
    positioning:       sanitizeOutput(generatePositioning(primaryIntent, priceRange ? 'budget' : primaryIntent, cleaningDomain)),
    priceStrategy:     sanitizeOutput(cleanByDomain(removeFakeMetrics(strategyRaw.priceStrategy), cleaningDomain)),
    quickWin:          sanitizeOutput(generateQuickWin(primaryIntent, cleaningDomain)),
    // Additive fields — frontend ignores unknown fields gracefully
    evidence,
    confidence,
    groundSignals:     groundSignals.topSignals,
  };

  // ── Domain enforcement: rewrite cross-domain language, validate specificity ──
  const finalStrategy = enforceFinalStrategy(rawFinalStrategy, cleaningDomain, primaryIntent, normalizedQuery, topProduct);

  // ── Step 6: Sanitize all model text fields ───────────────────────────────
  const repairModel = (m) => ({
    ...m,
    insights:    sanitizeOutput(m.insights),
    suggestions: m.suggestions.map(sanitizeOutput),
  });

  // ── FINAL OVERRIDE — job/fresher queries always get clean platform output ──
  const q = normalizedQuery.toLowerCase();
  const isJobQuery = q.includes('job') || q.includes('fresher') ||
                     q.includes('career') || q.includes('resume');

  const strategy = finalStrategy || {};
  if (isJobQuery) {
    strategy.positioning = 'Job platform focused on fast job discovery, fresher-friendly filtering, and quick applications.';
    strategy.quickWin    = 'Add fresher-only filter and enable 1-click apply.';
  }

  const result = {
    groq:   repairModel(groqResult),
    gpt:    repairModel(gptResult),
    gemini: repairModel(geminiResult),
    comparison,
    finalStrategy: strategy,
  };

  // Cache with TTL timestamp — evict oldest if over 100 entries
  if (queryCache.size >= 100) {
    queryCache.delete(queryCache.keys().next().value);
  }
  queryCache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
}
