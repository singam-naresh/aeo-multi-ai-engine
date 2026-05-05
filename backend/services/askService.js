import axios from 'axios';
import {
  validateAndCleanStructured,
  buildDynamicFallback,
  detectBrandConstraint,
} from './qualityEngine.js';

const GROQ_API_URL   = 'https://api.groq.com/openai/v1/chat/completions';
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


// ── Core Ask Function ─────────────────────────────────────────────────────────

export async function askAI(query) {
  const intent = detectIntent(query);
  const { system, user } = buildPrompt(query, intent);

  // Detect brand constraint — if query mentions a specific brand, all options must match
  const constraint = detectBrandConstraint(query);
  if (constraint) console.log(`[brand] Constraint detected: "${constraint.brand}"`);

  let structured      = null;
  let confidenceScore = 100;

  // ── Attempt 1: primary generation ────────────────────────────────────────
  const raw1    = await groqPost([{ role: 'system', content: system }, { role: 'user', content: user }], 0.35, 1024);
  const answer1 = stripGenericPhrases(raw1);

  if (intent !== 'INFORMATIONAL_QUERY') {
    const parsed1 = parseStructuredResponse(answer1);
    const result1 = parsed1
      ? validateAndCleanStructured(parsed1, constraint)
      : { cleaned: null, rejected: true, reasons: ['parse failed'], perOptionIssues: [] };

    if (!result1.rejected) {
      structured = result1.cleaned;
    } else {
      // ── Attempt 2: targeted retry with exact issue list ─────────────────
      confidenceScore -= 20;
      const allIssues = [...(result1.reasons || []), ...(result1.perOptionIssues || [])].filter(Boolean);
      console.log(`[retry] Attempt 1 rejected. Issues:\n  ${allIssues.join('\n  ')}`);

      const brandRule = constraint
        ? `\n- ALL options MUST be ${constraint.brand.toUpperCase()} products — no other brands allowed`
        : '';

      const retryUser = `${user}

PREVIOUS OUTPUT WAS REJECTED. Fix ALL of the following issues before regenerating:
${allIssues.map((r, i) => `${i + 1}. ${r}`).join('\n')}

MANDATORY FIXES:
- Brand + Model names only (e.g. "Samsung Galaxy S24 Ultra" not "Samsung")
- Real spec in every WHY: chip name, Hz, MP, mAh, GB, or GPU model
- Label must be PICK_IF: — never _IF: or IF:
- Each option must have a DIFFERENT category
- No vague phrases: "great performance", "powerful processor", "high-quality images"${brandRule}

Regenerate the complete response now.`;

      const raw2    = await groqPost([{ role: 'system', content: system }, { role: 'user', content: retryUser }], 0.15, 1024);
      const answer2 = stripGenericPhrases(raw2);
      const parsed2 = parseStructuredResponse(answer2);
      const result2 = parsed2
        ? validateAndCleanStructured(parsed2, constraint)
        : { cleaned: null, rejected: true, reasons: ['parse failed'], perOptionIssues: [] };

      if (!result2.rejected) {
        structured = result2.cleaned;
        confidenceScore -= 10;
      } else {
        console.log(`[fallback] Retry rejected: ${(result2.reasons || []).join('; ')}`);
        confidenceScore -= 40;
        structured = await buildDynamicFallback(query, system, groqPost, parseStructuredResponse, stripGenericPhrases, constraint);
      }
    }
  }

  confidenceScore = Math.max(0, Math.min(100, confidenceScore));
  console.log(`[confidence] Final score: ${confidenceScore}`);

  return { answer: answer1, structured, type: intent, confidenceScore };
}
