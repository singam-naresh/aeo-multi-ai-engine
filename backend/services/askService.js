import axios from 'axios';

const GROQ_API_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL  = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

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
SYSTEM ROLE: You are a product recommendation expert. Output structured, specific, decision-focused responses. No fluff. No generic phrases. Every word must help the user make a decision.

MANDATORY FORMAT RULES:
- EVERY line MUST start with one of these EXACT labels: INTRO: OPTION: CATEGORY: WHY: PICK_IF: DECIDE:
- The label after WHY: is always PICK_IF: — NEVER _IF: NEVER IF: NEVER PICK:
- NEVER output unlabeled text, extra labels, or blank lines between fields
- Return ONLY the structured output — no preamble, no explanation

PRODUCT NAME RULES (CRITICAL):
- ALWAYS output Brand + Model — minimum 2 words
- BAD: "Apple" "Samsung" "Google" "OnePlus" "Vivo"
- GOOD: "Apple iPhone 15 Pro" "Samsung Galaxy S24 Ultra" "Vivo iQOO 12 Pro" "OnePlus 12R"
- If unsure of exact model → use: "Samsung Galaxy S25 series" "latest iPhone 16 Pro models"

SPEC RULES — NO FAKE OR VAGUE SPECS:
- NEVER use: "flagship-level processor" "smooth performance" "high-quality images" "great camera"
- ALWAYS name the actual chip, GPU, display, or battery: "Snapdragon 8 Gen 3" "RTX 4080" "120Hz AMOLED" "5000mAh" "50MP OIS"
- If exact spec is unknown → use a realistic range: "~8–12h battery" "mid-range Dimensity chip"
- NEVER invent impossible specs: no "M3 chip in Android", no "256GB RAM", no random mAh numbers

QUALITY RULES — NO GENERIC LANGUAGE:
- BANNED phrases: "strong performance" "great value" "enhance user experience" "build credibility" "user trust signals" "strong brand authority" "alignment with search intent" "smooth and responsive" "high-quality" without proof
- EVERY WHY must contain at least ONE of: chip name, GPU, display Hz, battery mAh, camera MP, storage, weight, or a real differentiating feature
- GOOD: "Snapdragon 8 Gen 3 + 144Hz AMOLED + 5000mAh — handles 3-hour gaming sessions without throttling"
- BAD: "powerful processor and great display for gaming"

CATEGORY RULES — ASSIGN BY STRONGEST FEATURE:
- gaming → only if it has high-refresh display + gaming chip + cooling
- camera → only if it has the best camera system in the set
- battery → only if it has the largest or most efficient battery
- productivity → only if it has the best CPU/RAM for multitasking
- portability → only if it is the lightest or most compact
- value → only if it offers the best specs-per-price
- Each option MUST have a DIFFERENT category — no two options share the same category

COMPETITOR COMPARISON RULES:
- At least ONE option's WHY must reference how it compares to another option or a known competitor
- GOOD: "better low-light camera than the iQOO 12 Pro" "cheaper than the Galaxy S24 Ultra with similar display"
- This gives the user real decision-making power

PICK_IF RULES — SPECIFIC DECISION TRIGGERS:
- Must describe a real user situation, not a generic preference
- BAD: "if you want a good phone" "if you need performance"
- GOOD: "if you play BGMI or Call of Duty for 2+ hours daily" "if camera quality matters more than gaming performance"

SELF-VALIDATION (mandatory before outputting):
1. Every product name has Brand + Model? → If not, fix it
2. Every WHY has a real spec (chip/GPU/display/battery/camera)? → If not, rewrite it
3. Any generic phrases present? → Replace with specific details
4. All categories are different and logically assigned? → If not, reassign
5. Label after WHY is PICK_IF: (not _IF: not IF:)? → Verify every option
`.trim();

// ── Structured output format contract ────────────────────────────────────────
// Shared across all product and platform prompt builders.
const STRUCTURED_FORMAT = `
OUTPUT FORMAT (follow exactly — no deviations):

INTRO: [1 sentence — what the user is choosing and why it matters]

OPTION: [Full Brand + Model Name — e.g. "Samsung Galaxy S24 Ultra" NOT "Samsung"]
CATEGORY: [ONE word: gaming / productivity / battery / camera / portability / value / developer / creative]
WHY: [1–2 sentences with at least ONE specific detail: chip name, GPU model, display spec, battery size, camera MP, or real feature. NO vague words without proof.]
PICK_IF: [specific decision trigger — e.g. "you want the best low-light camera under ₹50k" NOT "you want a good phone"]

[Repeat OPTION block 3–5 times — each with a DIFFERENT CATEGORY]

DECIDE: [use-case → Product Name, one per line, 3–5 lines]
[use-case → Product Name]
[use-case → Product Name]

EXAMPLE (reference only — do not copy):
INTRO: Choosing a gaming laptop in 2025 comes down to GPU power, thermal management, and display quality.
OPTION: ASUS ROG Zephyrus G14 (2025)
CATEGORY: gaming
WHY: AMD Ryzen 9 + RTX 4070 GPU with 165Hz QHD display and ~10-hour battery — best thermal efficiency in its class.
PICK_IF: you want high FPS gaming with a laptop light enough to carry daily.
OPTION: Razer Blade 15
CATEGORY: productivity
WHY: Intel Core i9 + RTX 4080, 15.6-inch QHD 240Hz display, and premium aluminum build for creators and gamers.
PICK_IF: you need a laptop that handles both 4K video editing and gaming without compromise.
DECIDE: Best FPS performance → ASUS ROG Zephyrus G14 (2025)
Best for creators who game → Razer Blade 15
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

  // PRODUCT_QUERY — physical devices, consumer goods, and anything "best X" or "top X"
  if (/\b(phones?|mobiles?|smartphones?|laptops?|notebooks?|tablets?|ipad|ac|air.?conditioner|tv|television|headphones?|earbuds?|earphones?|speakers?|smartwatches?|watches?|cameras?|gpu|cpu|processor|ssd|ram|router|printer|monitors?|shoes?|sneakers?|boots?|bags?|backpack|clothing|shirt|jeans|dress|furniture|sofa|chair|mattress|refrigerator|fridge|washing.?machine|microwave|oven|vacuum|blender|mixer|cycle|bicycle|bike|scooter|car|vehicle|helmet|sunglasses|perfume|skincare|supplement|protein|earring|necklace|watch)\b/.test(q))
    return 'PRODUCT_QUERY';

  // PLATFORM_QUERY — digital services, SaaS, job sites, tools, apps
  if (/\b(jobs?|careers?|resume|hiring|internship|platforms?|websites?|apps?|software|saas|tools?|services?|crm|dashboard|automation|chatbots?|ai.?tools?|generators?|streaming|netflix|spotify|youtube|instagram|twitter|reddit|discord|slack|notion|figma|canva|shopify|wordpress|wix|squarespace|hosting|vpn|antivirus|browser|editor|ide|framework|library)\b/.test(q))
    return 'PLATFORM_QUERY';

  // PRODUCT_QUERY — catch "best X", "top X", "X under budget", "X for Y" patterns
  // that don't match specific keywords above (e.g. "best restaurants", "best books")
  if (/\b(best|top|cheapest|affordable|budget|premium|recommended|popular)\b/.test(q))
    return 'PRODUCT_QUERY';

  // INFORMATIONAL_QUERY — facts, people, places, history, how-to
  if (
    q.startsWith('who') || q.startsWith('what') || q.startsWith('when') ||
    q.startsWith('where') || q.startsWith('why') || q.startsWith('how') ||
    q.startsWith('is ') || q.startsWith('are ') || q.startsWith('does ') ||
    q.startsWith('did ') || q.startsWith('was ') || q.startsWith('were ') ||
    /\b(history|explain|define|meaning|difference between|vs|compare|versus)\b/.test(q)
  ) return 'INFORMATIONAL_QUERY';

  // Default — treat as product/recommendation query so it gets structured output
  return 'PRODUCT_QUERY';
}

// ── Prompt Builders ───────────────────────────────────────────────────────────

function buildPrompt(query, intent) {
  // ── Intent signals extracted from query for prompt injection ─────────────
  const q = query.toLowerCase();
  const intentHints = [
    /gaming|fps|rtx|gpu|graphics/.test(q)          && 'Query signals GAMING intent — include gaming-focused options.',
    /coding|programming|developer|dev\b/.test(q)   && 'Query signals DEVELOPER intent — include developer/productivity options.',
    /camera|photo|photography|portrait/.test(q)    && 'Query signals CAMERA intent — include camera-focused options.',
    /battery|endurance|all.?day/.test(q)           && 'Query signals BATTERY intent — include battery-focused options.',
    /under|budget|cheap|affordable|value/.test(q)  && 'Query signals BUDGET intent — focus on value-for-money options.',
    /\b(best|top)\s+\w+s?\s*(2025|2026)?\s*$/.test(q) && 'Query is GENERIC — return options with DIFFERENT categories.',
  ].filter(Boolean).join('\n');

  // ── Future / uncertain timeframe queries ─────────────────────────────────
  if (intent === 'PRODUCT_QUERY' && isFutureQuery(query)) {
    return {
      system: `${BASE_RULES}

DOMAIN: Consumer technology analyst.
SPECIAL RULE — FUTURE QUERY: Use SERIES language ("Samsung Galaxy S24 series", "latest iPhone Pro models"). Do NOT invent future model names or specs. Recommend CURRENT best options confidently.
${intentHints ? `\nINTENT SIGNALS:\n${intentHints}` : ''}

${STRUCTURED_FORMAT}`,
      user: `Query: ${query}`,
    };
  }

  if (intent === 'PRODUCT_QUERY') {
    // Detect if this is a tech product or a general recommendation query
    const isTechProduct = /laptop|phone|mobile|tablet|headphone|earbud|speaker|tv|monitor|gpu|cpu|camera|smartwatch|router|printer|ssd|ram/.test(q);

    if (isTechProduct) {
      return {
        system: `${BASE_RULES}

DOMAIN: Consumer technology expert.
SERIES LANGUAGE RULES:
- Use "Samsung Galaxy S24 series" NOT "Samsung Galaxy S23"
- Use "latest iPhone Pro models" NOT "iPhone 14"
- Use "latest Pixel flagship" NOT "Pixel 7"
- 3–5 CURRENT, REAL products only — no games, apps, or services
- WHY must include at least one specific spec or measurable detail
${intentHints ? `\nINTENT SIGNALS:\n${intentHints}` : ''}

${STRUCTURED_FORMAT}`,
        user: `Query: ${query}`,
      };
    }

    // General recommendation query (restaurants, books, shoes, movies, etc.)
    return {
      system: `${BASE_RULES}

DOMAIN: Expert recommendation engine with broad knowledge.
RULES:
- Give REAL, SPECIFIC recommendations — actual names, not generic descriptions
- Each option must be a real, well-known name (e.g. "Nike Air Max 270", "The Alchemist", "Zomato", "McDonald's")
- WHY must include a specific reason why this option stands out
- CATEGORY should reflect the type/use-case (e.g. value / premium / popular / trending / classic)
${intentHints ? `\nINTENT SIGNALS:\n${intentHints}` : ''}

${STRUCTURED_FORMAT}`,
      user: `Query: ${query}`,
    };
  }

  if (intent === 'PLATFORM_QUERY') {
    return {
      system: `${BASE_RULES}

DOMAIN: Digital platform and SaaS expert.
PLATFORM RULES:
- Real, active platforms only (LinkedIn, Indeed, Notion, Slack, etc.)
- No physical product language (no "battery", "display", "RAM")
- WHY must include a specific feature, user count, or measurable advantage
- Valid CATEGORY values: job-search / productivity / collaboration / automation / AI / analytics / value
${intentHints ? `\nINTENT SIGNALS:\n${intentHints}` : ''}

${STRUCTURED_FORMAT}`,
      user: `Query: ${query}`,
    };
  }

  // INFORMATIONAL_QUERY — direct prose answer
  return {
    system: `${BASE_RULES}

DOMAIN: Expert assistant with accurate, current knowledge.
RULES:
- Give a DIRECT, FACTUAL answer — 2–4 sentences max
- No bullet points unless listing multiple distinct items
- No business jargon, no strategy language, no pricing
- Plain prose only — the structured format does NOT apply here`,
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
    // Also normalise _IF: → PICK_IF: (model sometimes drops the PICK prefix)
    const clean = line
      .replace(/^[\d]+\.\s*/, '')
      .replace(/^[-•*]\s*/, '')
      .replace(/^_IF:/i, 'PICK_IF:');

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
      current.category = value || '';
      lastField = 'category';

    } else if (label === 'WHY' && current) {
      current.why = value || '';
      lastField = 'why';

    } else if ((label === 'PICK_IF' || label === 'PICK' || label === 'IF') && current) {
      // Accept PICK_IF:, PICK:, IF: — all map to pickIf
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

// ── Post-Parse Validation + Quality Layer ────────────────────────────────────

// Phrases that indicate a vague WHY field
const VAGUE_WHY_PATTERNS = [
  /\bflagship.?level processor\b/i,
  /\bsmooth (and responsive |)performance\b/i,
  /\bhigh.quality images?\b/i,
  /\bgreat (camera|display|performance|battery)\b/i,
  /\bpowerful processor\b/i,
  /\bexceptional (camera|performance|display)\b/i,
  /\badvanced (camera|features|technology)\b/i,
  /\bseamless (performance|experience)\b/i,
  /\brobust (performance|build)\b/i,
  /\bimpressive (specs|performance|camera)\b/i,
  /\bstrong (performance|build|camera)\b/i,
  /\benhanced (performance|experience|camera)\b/i,
];

// Real spec signals — WHY must contain at least one
const REAL_SPEC_RE = /\b(\d+\s*MP|\d+\s*Hz|\d+\s*GB|\d+\s*mAh|\d+\s*W|snapdragon|dimensity|helio|exynos|apple\s+[am]\d|rtx|gtx|radeon|intel\s+core|amd\s+ryzen|oled|amoled|lcd|ips|qhd|fhd|4k|uhd|~?\d+[\-–]\d+\s*h(our)?|ip6[78])/i;

// Single-word brand names that are invalid as full product names
const BARE_BRAND_RE = /^(apple|samsung|google|oneplus|xiaomi|vivo|oppo|realme|poco|motorola|nokia|sony|lg|huawei|honor|asus|dell|hp|lenovo|acer|msi|razer|microsoft|nothing)$/i;

// Infer category from WHY field keywords — used when category is duplicate or missing
function inferCategoryFromWhy(why) {
  const w = (why || '').toLowerCase();
  if (/\b(rtx|gtx|gpu|fps|gaming|frame rate|refresh rate.*\d+hz|\d+hz.*gaming)\b/.test(w)) return 'gaming';
  if (/\b(\d+\s*mp|camera|photo|portrait|low.light|zoom|ois)\b/.test(w))                  return 'camera';
  if (/\b(\d+\s*mah|battery|endurance|all.day|charging)\b/.test(w))                       return 'battery';
  if (/\b(lightweight|portab|slim|thin|compact|weight)\b/.test(w))                        return 'portability';
  if (/\b(ram|cpu|processor|core|multitask|productivity|work|develop)\b/.test(w))         return 'productivity';
  if (/\b(price|budget|affordable|value|cheap|cost)\b/.test(w))                           return 'value';
  if (/\b(creative|design|video edit|content creat|display.*color|color accuracy)\b/.test(w)) return 'creative';
  return null; // cannot infer — caller handles
}

// Remove duplicate tokens from a string
function dedupeTokens(text) {
  if (!text) return text;
  return text.replace(/\b(\w+)\s+\1\b/gi, '$1').replace(/\s{2,}/g, ' ').trim();
}

// Score a single option 0–4
function scoreOption(opt) {
  let score = 0;
  if (opt.name && opt.name.trim().split(/\s+/).length >= 2 && !BARE_BRAND_RE.test(opt.name.trim())) score++;
  if (opt.why && REAL_SPEC_RE.test(opt.why)) score++;
  if (opt.why && !VAGUE_WHY_PATTERNS.some((re) => re.test(opt.why))) score++;
  if (opt.pickIf && opt.pickIf.trim().split(/\s+/).length >= 4) score++;
  return score;
}

// Compute average score across all options
function avgScore(options) {
  if (!options || options.length === 0) return 0;
  return options.reduce((sum, o) => sum + (o._score || 0), 0) / options.length;
}

// Validate and clean a parsed structured response
// Returns { cleaned, rejected, reasons }
function validateAndCleanStructured(parsed) {
  if (!parsed) return { cleaned: null, rejected: true, reasons: ['null input'] };

  const reasons = [];
  const cleaned = {
    intro:       dedupeTokens(parsed.intro || ''),
    decideLines: (parsed.decideLines || []).map(dedupeTokens).filter(Boolean),
    options:     [],
  };

  const usedCategories = new Set();

  for (const opt of (parsed.options || [])) {
    const name   = dedupeTokens(opt.name   || '').trim();
    const why    = dedupeTokens(opt.why    || '').trim();
    const pickIf = dedupeTokens(opt.pickIf || '').trim();
    let   category = (opt.category || '').toLowerCase().trim();

    // Reject bare brand names
    if (BARE_BRAND_RE.test(name)) {
      console.warn(`[validate] Skipping bare brand name: "${name}"`);
      reasons.push(`bare brand name: "${name}"`);
      continue;
    }

    // Log missing real spec (keep option, flag for scoring)
    if (why && !REAL_SPEC_RE.test(why)) {
      console.warn(`[validate] No real spec in WHY for "${name}": "${why.slice(0, 80)}"`);
    }

    // Resolve duplicate or missing category — infer from WHY, never use "balanced"
    if (!category || usedCategories.has(category)) {
      const inferred = inferCategoryFromWhy(why);
      if (inferred && !usedCategories.has(inferred)) {
        console.warn(`[validate] Category "${category}" duplicate/missing for "${name}" — inferred "${inferred}"`);
        category = inferred;
      } else {
        // Find any unused valid category as last resort
        const fallbackCats = ['gaming','camera','battery','portability','productivity','value','creative','developer'];
        const unused = fallbackCats.find((c) => !usedCategories.has(c));
        category = unused || category || 'value';
        console.warn(`[validate] Category reassigned to "${category}" for "${name}"`);
      }
    }
    usedCategories.add(category);

    const score = scoreOption({ name, why, pickIf });
    console.log(`[quality] "${name}" score: ${score}/4`);
    cleaned.options.push({ name, category, why, pickIf, _score: score });
  }

  // Sort best options first
  cleaned.options.sort((a, b) => (b._score || 0) - (a._score || 0));

  // ── Hard rejection checks ─────────────────────────────────────────────────
  const avg = avgScore(cleaned.options);
  const noSpecCount = cleaned.options.filter((o) => !REAL_SPEC_RE.test(o.why || '')).length;
  const hasBareNames = cleaned.options.some((o) => BARE_BRAND_RE.test(o.name.trim()));
  const dupCategories = cleaned.options.length !== new Set(cleaned.options.map((o) => o.category)).size;

  if (avg < 2.5)        reasons.push(`avg score ${avg.toFixed(1)} < 2.5`);
  if (noSpecCount > 1)  reasons.push(`${noSpecCount} options lack real specs`);
  if (hasBareNames)     reasons.push('bare brand names present after cleaning');
  if (dupCategories)    reasons.push('duplicate categories remain');
  if (cleaned.options.length < 2) reasons.push('fewer than 2 valid options');

  const rejected = reasons.length > 0;
  if (rejected) console.warn(`[reject] Low quality detected — reasons: ${reasons.join('; ')}`);

  return { cleaned, rejected, reasons };
}

// ── Controlled Fallback ───────────────────────────────────────────────────────
// Returns a safe structured response based on query category.
// Uses real current products — never generic placeholders.

function buildFallbackStructured(query) {
  const q = query.toLowerCase();

  if (/gaming.*laptop|laptop.*gaming/.test(q)) return {
    intro: 'These are the top gaming laptops available right now.',
    options: [
      { name: 'ASUS ROG Zephyrus G14 (2025)', category: 'gaming',       why: 'AMD Ryzen 9 + RTX 4070, 165Hz QHD display, ~10h battery — best thermal efficiency in class.', pickIf: 'you want high FPS gaming with a portable build under 2kg.', _score: 4 },
      { name: 'Razer Blade 15 (2024)',         category: 'productivity', why: 'Intel Core i9 + RTX 4080, 15.6-inch QHD 240Hz display, premium CNC aluminum chassis.', pickIf: 'you need a laptop for both 4K video editing and gaming.', _score: 4 },
      { name: 'Lenovo Legion Pro 7i',          category: 'value',        why: 'Intel Core i9-13900HX + RTX 4080, 16-inch 240Hz IPS display at a competitive price point.', pickIf: 'you want flagship gaming performance without paying Razer prices.', _score: 4 },
    ],
    decideLines: ['Best portability → ASUS ROG Zephyrus G14 (2025)', 'Best display → Razer Blade 15 (2024)', 'Best value → Lenovo Legion Pro 7i'],
  };

  if (/laptop|notebook|macbook/.test(q)) return {
    intro: 'These are the best laptops for everyday use and productivity in 2025.',
    options: [
      { name: 'Apple MacBook Air M3',       category: 'battery',      why: 'Apple M3 chip, 18h battery life, 13.6-inch Liquid Retina display — best battery in its class.', pickIf: 'you want all-day battery life with a lightweight build under 1.3kg.', _score: 4 },
      { name: 'Dell XPS 15 (2025)',         category: 'productivity',  why: 'Intel Core i7-13700H, 16GB RAM, 15.6-inch 3.5K OLED display — ideal for developers and creators.', pickIf: 'you need a high-resolution display for coding or content creation.', _score: 4 },
      { name: 'ASUS ZenBook 14 OLED',       category: 'portability',   why: 'AMD Ryzen 7 7730U, 14-inch 2.8K OLED display, weighs 1.39kg — best OLED display in portable form.', pickIf: 'you want an OLED display in a compact, travel-friendly laptop.', _score: 4 },
    ],
    decideLines: ['Best battery → Apple MacBook Air M3', 'Best display for work → Dell XPS 15 (2025)', 'Best portability → ASUS ZenBook 14 OLED'],
  };

  if (/phone|mobile|smartphone/.test(q)) return {
    intro: 'These are the top smartphones to consider right now.',
    options: [
      { name: 'Samsung Galaxy S24 Ultra', category: 'camera',       why: '200MP primary camera, Snapdragon 8 Gen 3, 5000mAh battery with 45W charging — best zoom camera in Android.', pickIf: 'you want the best Android camera with S Pen support.', _score: 4 },
      { name: 'Apple iPhone 15 Pro',      category: 'productivity',  why: 'A17 Pro chip, 48MP main camera, titanium build, USB-C 3.0 — fastest mobile chip available.', pickIf: 'you want the fastest chip and best app ecosystem.', _score: 4 },
      { name: 'OnePlus 12',               category: 'value',         why: 'Snapdragon 8 Gen 3, 5400mAh battery, 100W SUPERVOOC charging, 6.82-inch 120Hz AMOLED.', pickIf: 'you want flagship specs with the fastest charging under ₹65k.', _score: 4 },
    ],
    decideLines: ['Best camera → Samsung Galaxy S24 Ultra', 'Best performance → Apple iPhone 15 Pro', 'Best value → OnePlus 12'],
  };

  // Generic fallback
  return {
    intro: 'Here are the top options based on your query.',
    options: [
      { name: 'Samsung Galaxy S24 Ultra', category: 'camera',      why: '200MP camera, Snapdragon 8 Gen 3, 5000mAh — top-ranked Android flagship.', pickIf: 'you want the best camera and performance in one device.', _score: 3 },
      { name: 'Apple iPhone 15 Pro',      category: 'productivity', why: 'A17 Pro chip, titanium build, 48MP camera — fastest mobile processor available.', pickIf: 'you are in the Apple ecosystem and want the best performance.', _score: 3 },
      { name: 'OnePlus 12',               category: 'value',        why: 'Snapdragon 8 Gen 3, 100W charging, 5400mAh — best specs-per-price in flagship tier.', pickIf: 'you want flagship performance without paying premium pricing.', _score: 3 },
    ],
    decideLines: ['Best camera → Samsung Galaxy S24 Ultra', 'Best performance → Apple iPhone 15 Pro', 'Best value → OnePlus 12'],
  };
}

// ── Core Ask Function ─────────────────────────────────────────────────────────

export async function askAI(query) {
  const intent = detectIntent(query);
  const { system, user } = buildPrompt(query, intent);

  // ── Attempt 1: primary generation ────────────────────────────────────────
  const raw1 = await groqPost(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    0.35, 1024,
  );
  const answer1 = stripGenericPhrases(raw1);

  let structured = null;

  if (intent !== 'INFORMATIONAL_QUERY') {
    const parsed1 = parseStructuredResponse(answer1);
    const { cleaned: cleaned1, rejected: rejected1 } = parsed1
      ? validateAndCleanStructured(parsed1)
      : { cleaned: null, rejected: true };

    if (!rejected1) {
      // Attempt 1 passed — use it
      structured = cleaned1;
    } else {
      // ── Attempt 2: retry with strict instruction ────────────────────────
      console.log('[retry] Attempt 1 rejected — regenerating with strict instruction');
      const retryUser = `${user}\n\nPREVIOUS OUTPUT WAS REJECTED FOR LOW QUALITY.\nYou MUST:\n- Use Brand + Model names (e.g. "Samsung Galaxy S24 Ultra" not "Samsung")\n- Include a real spec in every WHY field (chip, Hz, MP, mAh, GB)\n- Use PICK_IF: label (not _IF:)\n- Assign different categories to each option\nRegenerate now with strict adherence.`;

      const raw2 = await groqPost(
        [{ role: 'system', content: system }, { role: 'user', content: retryUser }],
        0.2, 1024, // lower temperature for more deterministic output
      );
      const answer2 = stripGenericPhrases(raw2);
      const parsed2 = parseStructuredResponse(answer2);
      const { cleaned: cleaned2, rejected: rejected2 } = parsed2
        ? validateAndCleanStructured(parsed2)
        : { cleaned: null, rejected: true };

      if (!rejected2) {
        // Retry passed
        structured = cleaned2;
      } else {
        // ── Fallback: use controlled safe output ──────────────────────────
        console.log('[fallback] Both attempts rejected — using controlled fallback');
        structured = buildFallbackStructured(query);
      }
    }
  }

  // Use the best available answer text (attempt 1 preferred for the raw text field)
  const answer = answer1;
  return { answer, structured, type: intent };
}
