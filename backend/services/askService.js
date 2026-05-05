import axios from 'axios';

const GROQ_API_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL  = 'llama3-70b-8192';
const FALLBACK_MODEL = 'llama3-8b-8192';

// ── Groq call with automatic model fallback ───────────────────────────────────
async function groqPost(messages, temperature, maxTokens) {
  const body = { messages, temperature, max_tokens: maxTokens };
  const headers = {
    Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    console.log(`[ask] trying model: ${PRIMARY_MODEL}`);
    const res = await axios.post(GROQ_API_URL, { ...body, model: PRIMARY_MODEL }, { headers });
    const content = res.data.choices[0]?.message?.content?.trim() || '';
    console.log(`[ask] PRIMARY model responded (${content.length} chars)`);
    console.log(`[ask] RAW:`, content.slice(0, 300));
    return content;
  } catch (primaryErr) {
    console.error(`[ask] ${PRIMARY_MODEL} failed:`, primaryErr.response?.data?.error?.message || primaryErr.message);
    console.log(`[ask] retrying with fallback model: ${FALLBACK_MODEL}`);
    try {
      const res = await axios.post(GROQ_API_URL, { ...body, model: FALLBACK_MODEL }, { headers });
      const content = res.data.choices[0]?.message?.content?.trim() || '';
      console.log(`[ask] FALLBACK model responded (${content.length} chars)`);
      console.log(`[ask] RAW:`, content.slice(0, 300));
      return content;
    } catch (fallbackErr) {
      console.error(`[ask] ${FALLBACK_MODEL} also failed:`, fallbackErr.response?.data?.error?.message || fallbackErr.message);
      throw fallbackErr; // let askAI's caller handle it
    }
  }
}

// ── System role + shared rules ────────────────────────────────────────────────
// This is the production-grade system prompt injected into every structured query.
// It defines the AI's role, output contract, and quality constraints.

const BASE_RULES = `
SYSTEM ROLE: You are a production-grade AI response engine. You must generate structured, deterministic output that is machine-parseable and user-useful. No conversational fluff. No deviations.

CORE RULES (MANDATORY — NO EXCEPTIONS):
- EVERY line MUST start with one of these EXACT labels: INTRO: OPTION: CATEGORY: WHY: PICK_IF: DECIDE:
- NEVER output unlabeled text
- NEVER change label names
- NEVER add extra labels
- NEVER include explanations outside the format
- NEVER use filler phrases (e.g. "Here are", "Top picks", "As of now", "Let's explore", "Market Direction")
- NEVER say "as of my knowledge cutoff", "I may be outdated", or "I cannot access real-time data"
- NEVER mention past years unless the user explicitly asks about history
- Assume CURRENT YEAR context (2025–2026)
- Use CURRENT products and brands — avoid outdated models
- Output MUST be clean, concise, and structured
- If output violates ANY rule → regenerate internally before responding
- Return ONLY the final structured output
`.trim();

// ── Structured output format contract ────────────────────────────────────────
// Shared across all product and platform prompt builders.
const STRUCTURED_FORMAT = `
OUTPUT STRUCTURE (follow exactly):

INTRO: [one sentence — state the decision context, no filler]

OPTION: [Full Product or Platform Name]
CATEGORY: [ONE word only: gaming / productivity / battery / camera / portability / balanced / developer / creative / value / collaboration / automation]
WHY: [MUST include at least ONE real spec or measurable detail — e.g. RTX 4090, M3 chip, 5000mAh, 120Hz, 32GB RAM, 4K OLED. No vague words like "powerful", "great", "excellent" without proof.]
PICK_IF: [real user decision trigger — specific, not generic]

[Repeat OPTION block 3–5 times. For GENERIC queries (e.g. "best laptops"), each OPTION MUST have a DIFFERENT CATEGORY — do NOT return 3 gaming options for a generic query.]

DECIDE: [Scenario → Product, one per line, 3–5 lines]
[Scenario → Product]
[Scenario → Product]

QUALITY CONSTRAINTS:
- WHY must include at least ONE real spec (CPU, GPU, battery hours, RAM, display, etc.)
- CATEGORY must be ONE word, consistent across all options
- PICK_IF must be a real user decision trigger, not a generic phrase
- DECIDE must map user intent → best option clearly
- No duplicate options
- No outdated models
- No markdown, bullets, or symbols
- No paragraphs outside the structure
`.trim();

// Generic phrases that degrade output quality — stripped before returning
const GENERIC_PHRASES = [
  /\bwell[- ]rounded option\b/gi,
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
  // ── Template section headers ─────────────────────────────────────────────
  /^top picks?\s*[\(\[]?current\s+best\s+options?[\)\]]?\s*:?\s*/gim,
  /^top picks?\s*:?\s*/gim,
  /^top platforms?\s*:?\s*/gim,
  /^market direction\s*:?\s*/gim,
  /^best for\s*:?\s*/gim,
  /^here are the\s+(best|top)\b[^:\n]*:\s*/gim,
  /^(my |the )?(top |best )?(picks?|recommendations?|choices?)\s*:?\s*/gim,
  // ── Filler trend lines ────────────────────────────────────────────────────
  /^(the )?(industry|market|space|sector) is (heading|moving|shifting|trending)[^\n]*\n?/gim,
  /^expect (to see|more)[^\n]*\n?/gim,
  /^(in the (coming|near) (months|years|future))[^\n]*\n?/gim,
  /^(overall|in summary|to summarize|in conclusion)[,.]?[^\n]*\n?/gim,
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
  // ── Shared structured output rules ───────────────────────────────────────
  const STRUCTURED_FORMAT = `
OUTPUT FORMAT — STRICT. Every line MUST start with one of these exact labels.
NO unlabeled lines. NO free text. NO numbered lists. NO bullet points.

INTRO: [one sentence, human tone — e.g. "If you're choosing a gaming laptop right now, these are the ones that actually matter:"]

OPTION: [Full Product or Platform Name]
CATEGORY: [one of: gaming / productivity / battery / camera / portability / value / balanced / developer / creative]
WHY: [1–2 sentences — MUST include at least one specific detail: GPU model, CPU, battery hours, RAM, display spec, or measurable advantage. No vague words like "powerful", "great", "excellent" without proof.]
PICK_IF: [one decision trigger — e.g. "you want max FPS without thermal throttling"]

OPTION: [Full Product or Platform Name]
CATEGORY: [category]
WHY: [specific detail required]
PICK_IF: [decision trigger]

OPTION: [Full Product or Platform Name]
CATEGORY: [category]
WHY: [specific detail required]
PICK_IF: [decision trigger]

DECIDE: [scenario → product, one per line — e.g. "Gaming → Razer Blade 18"]
[scenario → product]
[scenario → product]

RULES:
- 3 options minimum, 5 maximum
- EVERY option MUST have OPTION:, CATEGORY:, WHY:, PICK_IF: — all four, in order
- DECIDE: block MUST have 3–5 lines, each as "scenario → product"
- For generic queries (e.g. "best laptops"), use DIFFERENT categories per option — do NOT give 3 gaming laptops
- No "Market Direction", no trend sentences, no filler, no disclaimers
`.trim();

  // ── Future / uncertain timeframe queries ─────────────────────────────────
  if (intent === 'PRODUCT_QUERY' && isFutureQuery(query)) {
    return {
      system: `You are a consumer technology analyst with current market knowledge.
${BASE_RULES}

SPECIAL RULE — FUTURE QUERY:
- Use SERIES language: "Samsung Galaxy S24 series", "latest iPhone Pro models", "latest Pixel flagship"
- Do NOT invent specific future model names or specs
- Recommend the CURRENT best options confidently — they are the right choice today

${STRUCTURED_FORMAT}`,
      user: `Query: ${query}`,
    };
  }

  if (intent === 'PRODUCT_QUERY') {
    return {
      system: `You are a consumer technology expert with current market knowledge.
${BASE_RULES}

ADDITIONAL RULES:
- Use SERIES language, not outdated model numbers:
  ✅ "Samsung Galaxy S24 series"  ✅ "latest iPhone Pro models"  ✅ "latest Pixel flagship"
- 3–5 CURRENT, REAL products only — no games, apps, or services
- No fake pricing
- WHY must include at least one specific spec or measurable detail

${STRUCTURED_FORMAT}`,
      user: `Query: ${query}`,
    };
  }

  if (intent === 'PLATFORM_QUERY') {
    return {
      system: `You are a digital platform and SaaS expert with current market knowledge.
${BASE_RULES}

ADDITIONAL RULES:
- Real, active platforms only (LinkedIn, Indeed, Notion, Slack, etc.)
- No physical product language (no "battery", "display", "RAM")
- WHY must include a specific feature, user count, or measurable advantage
- Use CATEGORY values like: job search / productivity / collaboration / automation / AI / analytics

${STRUCTURED_FORMAT}`,
      user: `Query: ${query}`,
    };
  }

  // INFORMATIONAL_QUERY — keep as direct prose, no structured format needed
  return {
    system: `You are an expert assistant with accurate, current knowledge.
${BASE_RULES}

RULES:
- Give a DIRECT, FACTUAL answer — 2–4 sentences max
- No bullet points unless listing multiple distinct items
- No business jargon, no strategy language, no pricing`,
    user: `Query: ${query}`,
  };
}

// ── Structured Response Parser ────────────────────────────────────────────────
// Parses the INTRO/OPTION/CATEGORY/WHY/PICK_IF/DECIDE format into a typed object.
// Tolerant of minor AI deviations (extra spaces, old label names, inline continuations).
// Falls back to null only when no recognisable structure is found at all.

function parseStructuredResponse(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let intro = '';
  const options = [];
  const decideLines = [];
  let current = null;
  let inDecide = false;
  let lastField = null; // tracks which field of current option we last wrote to

  for (const line of lines) {
    // ── Strip leading list markers the AI sometimes adds (1. 2. •) ──────────
    const clean = line.replace(/^[\d]+\.\s*/, '').replace(/^[-•*]\s*/, '');

    // ── Label matching — tolerant of spacing and old label variants ──────────
    const labelMatch = clean.match(/^([A-Z][A-Z_ ]{1,12}):\s*(.*)/);
    const label  = labelMatch ? labelMatch[1].trim().toUpperCase().replace(/\s+/g, '_') : null;
    const value  = labelMatch ? labelMatch[2].trim() : null;

    if (label === 'INTRO') {
      intro = value || '';
      inDecide = false;
      lastField = null;

    } else if (label === 'OPTION') {
      if (current) options.push(current);
      current = { name: value || '', category: '', why: '', pickIf: '' };
      inDecide = false;
      lastField = 'name';

    } else if ((label === 'CATEGORY' || label === 'BEST_FOR') && current) {
      // Accept both CATEGORY: and legacy BEST FOR: / BEST_FOR:
      current.category = value || '';
      lastField = 'category';

    } else if (label === 'WHY' && current) {
      current.why = value || '';
      lastField = 'why';

    } else if ((label === 'PICK_IF' || label === 'PICK_IF' || label === 'PICK') && current) {
      // Accept PICK_IF:, PICK IF:, PICK:
      current.pickIf = value || '';
      lastField = 'pickIf';

    } else if (label === 'DECIDE') {
      if (current) { options.push(current); current = null; }
      if (value) decideLines.push(value);
      inDecide = true;
      lastField = null;

    } else if (inDecide && clean) {
      // Every non-label line inside DECIDE block is a decision line
      decideLines.push(clean);

    } else if (current && clean && !labelMatch) {
      // Unlabeled continuation line — append to the last written field
      if (lastField === 'why') {
        current.why += (current.why ? ' ' : '') + clean;
      } else if (lastField === 'pickIf') {
        current.pickIf += (current.pickIf ? ' ' : '') + clean;
      }
      // Silently drop unlabeled lines that don't belong to a known field
    }
  }
  if (current) options.push(current);

  // Filter out empty/incomplete options (must have at least a name and why)
  const validOptions = options.filter((o) => o.name && o.why);

  // Return null only when truly nothing was parsed
  if (!intro && validOptions.length === 0) return null;

  return { intro, options: validOptions, decideLines };
}

// ── Core Ask Function ─────────────────────────────────────────────────────────

export async function askAI(query) {
  const intent = detectIntent(query);
  const { system, user } = buildPrompt(query, intent);

  const raw = await groqPost(
    [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
    0.35,
    1024,
  );

  const answer     = stripGenericPhrases(raw);
  const structured = (intent !== 'INFORMATIONAL_QUERY')
    ? parseStructuredResponse(answer)
    : null;

  return { answer, structured, type: intent };
}
