// ── Quality Control Engine ────────────────────────────────────────────────────
// Validates, scores, and enforces output quality for structured AI responses.
// Rejects weak outputs, retries with targeted corrections, falls back dynamically.

// Vague phrases that disqualify a WHY field
export const VAGUE_WHY_PATTERNS = [
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
  /\bsuperior (performance|camera|display)\b/i,
  /\bexcellent (performance|camera|display|battery)\b/i,
];

// Real measurable spec — WHY must contain at least one
export const REAL_SPEC_RE = /\b(\d+\s*MP|\d+\s*Hz|\d+\s*GB|\d+\s*mAh|\d+\s*W|snapdragon\s*\d|dimensity\s*\d|helio\s*[gp]\d|exynos\s*\d|apple\s+[am]\d|a1[5-9]\s*pro|rtx\s*\d{4}|gtx\s*\d{4}|radeon\s*rx|intel\s+core\s+i[3579]|amd\s+ryzen\s+[579]|oled|amoled|lcd|ips|qhd|fhd|4k|uhd|~?\d+[\-–]\d+\s*h(our)?|ip6[78]|\d+w\s*(fast|super|turbo|warp|dart)?\s*charg)/i;

// Single-word brand names — invalid as full product names
export const BARE_BRAND_RE = /^(apple|samsung|google|oneplus|xiaomi|vivo|oppo|realme|poco|motorola|nokia|sony|lg|huawei|honor|asus|dell|hp|lenovo|acer|msi|razer|microsoft|nothing|iqoo|tecno|infinix|lava)$/i;

// ── Factual sanity — catches obvious hallucinations ───────────────────────────
export function hasFakeSpecs(why, name) {
  const w = (why  || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (/phone|mobile|smartphone|iphone|galaxy|pixel|oneplus|vivo|oppo|realme/.test(n)) {
    const ramMatch = w.match(/(\d+)\s*gb\s*ram/);
    if (ramMatch && parseInt(ramMatch[1]) > 64)
      return `impossible RAM: ${ramMatch[1]}GB on phone`;
  }
  const mahMatch = w.match(/(\d{4,5})\s*mah/);
  if (mahMatch && parseInt(mahMatch[1]) > 7000)
    return `impossible battery: ${mahMatch[1]}mAh`;
  if (/iphone/.test(n) && /snapdragon/.test(w))
    return 'iPhone cannot have Snapdragon chip';
  if (!/apple|iphone|ipad|macbook/.test(n) && /\bapple\s+m\d\b/.test(w))
    return 'non-Apple device with Apple M chip';
  return null;
}

// ── Category inference from WHY keywords — never returns "balanced" ───────────
export function inferCategoryFromWhy(why) {
  const w = (why || '').toLowerCase();
  if (/\b(rtx|gtx|gpu|fps|gaming|\d+hz.*gaming|gaming.*\d+hz)\b/.test(w)) return 'gaming';
  if (/\b(\d+\s*mp|camera|photo|portrait|low.light|zoom|ois|telephoto)\b/.test(w)) return 'camera';
  if (/\b(\d+\s*mah|battery|endurance|all.day|\d+h\s*battery|charging)\b/.test(w)) return 'battery';
  if (/\b(lightweight|portab|slim|thin|compact|weight|travel)\b/.test(w)) return 'portability';
  if (/\b(ram|cpu|processor|core|multitask|productivity|work|develop|coding)\b/.test(w)) return 'productivity';
  if (/\b(price|budget|affordable|value|cheap|cost|rupee|inr|₹)\b/.test(w)) return 'value';
  if (/\b(creative|design|video edit|content creat|color accuracy)\b/.test(w)) return 'creative';
  return null;
}

// ── Token deduplication ───────────────────────────────────────────────────────
export function dedupeTokens(text) {
  if (!text) return text;
  return text.replace(/\b(\w+)\s+\1\b/gi, '$1').replace(/\s{2,}/g, ' ').trim();
}

// ── Option scoring 0–4 ────────────────────────────────────────────────────────
export function scoreOption(opt) {
  let score = 0;
  if (opt.name && opt.name.trim().split(/\s+/).length >= 2 && !BARE_BRAND_RE.test(opt.name.trim())) score++;
  if (opt.why && REAL_SPEC_RE.test(opt.why)) score++;
  if (opt.why && !VAGUE_WHY_PATTERNS.some((re) => re.test(opt.why))) score++;
  if (opt.pickIf && opt.pickIf.trim().split(/\s+/).length >= 4) score++;
  return score;
}

export function avgScore(options) {
  if (!options || options.length === 0) return 0;
  return options.reduce((sum, o) => sum + (o._score || 0), 0) / options.length;
}

// ── Per-option validation — returns array of issue strings ───────────────────
export function validateOption(opt, index) {
  const issues = [];
  const name   = (opt.name   || '').trim();
  const why    = (opt.why    || '').trim();
  const pickIf = (opt.pickIf || '').trim();

  if (!name || BARE_BRAND_RE.test(name))
    issues.push(`Option ${index + 1} has single-word brand name: "${name}"`);
  if (!why || !REAL_SPEC_RE.test(why))
    issues.push(`Option ${index + 1} (${name}) WHY missing real spec`);
  if (why && VAGUE_WHY_PATTERNS.some((re) => re.test(why)))
    issues.push(`Option ${index + 1} (${name}) WHY contains vague phrase`);
  if (!pickIf || pickIf.split(/\s+/).length < 4)
    issues.push(`Option ${index + 1} (${name}) PICK_IF too generic`);
  const fakeSpec = hasFakeSpecs(why, name);
  if (fakeSpec) issues.push(`Option ${index + 1} (${name}) impossible spec: ${fakeSpec}`);

  return issues;
}

// ── Differentiation check — flags overlapping use-cases ──────────────────────
export function checkDifferentiation(options) {
  const issues = [];
  const KW = [
    /\b(gaming|fps|gpu|rtx)\b/i,
    /\b(camera|mp|photo|portrait)\b/i,
    /\b(battery|mah|endurance)\b/i,
    /\b(portab|slim|lightweight|compact)\b/i,
    /\b(productivity|multitask|work|develop)\b/i,
    /\b(value|budget|affordable|price)\b/i,
  ];
  for (const kw of KW) {
    const matching = options.filter((o) => kw.test(o.why || ''));
    if (matching.length > 1)
      issues.push(`Overlapping use-case across: ${matching.map((o) => o.name).join(', ')}`);
  }
  return issues;
}

// ── Full validate + clean ─────────────────────────────────────────────────────
// Returns { cleaned, rejected, reasons, perOptionIssues }
export function validateAndCleanStructured(parsed) {
  if (!parsed) return { cleaned: null, rejected: true, reasons: ['null input'], perOptionIssues: [] };

  const allReasons      = [];
  const perOptionIssues = [];
  const cleaned = {
    intro:       dedupeTokens(parsed.intro || ''),
    decideLines: (parsed.decideLines || []).map(dedupeTokens).filter(Boolean),
    options:     [],
  };
  const usedCategories = new Set();

  for (let i = 0; i < (parsed.options || []).length; i++) {
    const opt    = parsed.options[i];
    const name   = dedupeTokens(opt.name   || '').trim();
    const why    = dedupeTokens(opt.why    || '').trim();
    const pickIf = dedupeTokens(opt.pickIf || '').trim();
    let   category = (opt.category || '').toLowerCase().trim();

    perOptionIssues.push(...validateOption({ name, why, pickIf }, i));

    if (BARE_BRAND_RE.test(name)) {
      console.warn(`[validate] Skipping bare brand: "${name}"`);
      continue;
    }

    // Resolve duplicate/missing category — infer from WHY, never use "balanced"
    if (!category || usedCategories.has(category)) {
      const inferred    = inferCategoryFromWhy(why);
      const fallbackCats = ['gaming','camera','battery','portability','productivity','value','creative','developer'];
      const resolved    = (inferred && !usedCategories.has(inferred))
        ? inferred
        : (fallbackCats.find((c) => !usedCategories.has(c)) || 'value');
      console.warn(`[validate] Category "${category}" → "${resolved}" for "${name}"`);
      category = resolved;
    }
    usedCategories.add(category);

    const score = scoreOption({ name, why, pickIf });
    console.log(`[quality] "${name}" score: ${score}/4`);
    cleaned.options.push({ name, category, why, pickIf, _score: score });
  }

  cleaned.options.sort((a, b) => (b._score || 0) - (a._score || 0));

  // Hard rejection gate
  const avg         = avgScore(cleaned.options);
  const noSpecCount = cleaned.options.filter((o) => !REAL_SPEC_RE.test(o.why || '')).length;
  const hasBare     = cleaned.options.some((o) => BARE_BRAND_RE.test(o.name.trim()));
  const dupCats     = cleaned.options.length !== new Set(cleaned.options.map((o) => o.category)).size;
  const diffIssues  = checkDifferentiation(cleaned.options);

  if (avg < 2.5)                  allReasons.push(`avg score ${avg.toFixed(1)} < 2.5`);
  if (noSpecCount > 1)            allReasons.push(`${noSpecCount} options missing real specs`);
  if (hasBare)                    allReasons.push('bare brand names remain');
  if (dupCats)                    allReasons.push('duplicate categories remain');
  if (cleaned.options.length < 2) allReasons.push('fewer than 2 valid options');
  if (diffIssues.length > 2)      allReasons.push(`use-case overlap: ${diffIssues.slice(0,2).join('; ')}`);

  const rejected = allReasons.length > 0;
  if (rejected) console.warn(`[reject] ${allReasons.join(' | ')}`);

  return { cleaned, rejected, reasons: allReasons, perOptionIssues };
}

// ── Dynamic Fallback ──────────────────────────────────────────────────────────
// Asks the AI to generate a fallback with explicit seed product names.
// Falls back to static only if the AI call itself fails.

export async function buildDynamicFallback(query, system, groqPost, parseStructuredResponse, stripGenericPhrases) {
  const q = query.toLowerCase();

  let seedProducts;
  if (/gaming.*laptop|laptop.*gaming/.test(q))
    seedProducts = 'ASUS ROG Zephyrus G14 (2025), Razer Blade 15 (2024), Lenovo Legion Pro 7i (2024), MSI Stealth 16 Studio, Acer Predator Helios 18';
  else if (/laptop|notebook|macbook/.test(q))
    seedProducts = 'Apple MacBook Air M3, Dell XPS 15 (2025), ASUS ZenBook 14 OLED, Lenovo ThinkPad X1 Carbon Gen 12, HP Spectre x360 14';
  else if (/phone|mobile|smartphone/.test(q))
    seedProducts = 'Samsung Galaxy S24 Ultra, Apple iPhone 15 Pro, OnePlus 12, Google Pixel 9 Pro, Xiaomi 14 Ultra';
  else if (/headphone|earbud|earphone/.test(q))
    seedProducts = 'Sony WH-1000XM5, Apple AirPods Pro 2, Bose QuietComfort 45, Samsung Galaxy Buds3 Pro, Jabra Evolve2 85';
  else if (/tablet|ipad/.test(q))
    seedProducts = 'Apple iPad Pro M4, Samsung Galaxy Tab S9 Ultra, Microsoft Surface Pro 10, Lenovo Tab P12 Pro';
  else
    seedProducts = 'Samsung Galaxy S24 Ultra, Apple iPhone 15 Pro, OnePlus 12, Google Pixel 9 Pro, Xiaomi 14 Ultra';

  const fallbackUser = `Query: ${query}

FALLBACK GENERATION — use ONLY these product names (pick 3 most relevant):
${seedProducts}

For each:
OPTION: [exact name from list]
CATEGORY: [one word: gaming/camera/battery/portability/productivity/value]
WHY: [real spec — chip, Hz, MP, mAh, or GPU — no vague phrases]
PICK_IF: [specific use-case, minimum 5 words]
DECIDE: [3 lines: use-case → product]`;

  try {
    console.log('[fallback] Requesting dynamic fallback from AI');
    const raw    = await groqPost([{ role: 'system', content: system }, { role: 'user', content: fallbackUser }], 0.15, 800);
    const parsed = parseStructuredResponse(stripGenericPhrases(raw));
    if (parsed && parsed.options && parsed.options.length >= 2) {
      const { cleaned, rejected } = validateAndCleanStructured(parsed);
      if (!rejected) {
        console.log('[fallback] Dynamic fallback passed validation');
        return cleaned;
      }
    }
  } catch (e) {
    console.error('[fallback] Dynamic fallback AI call failed:', e.message);
  }

  // Static safety net — only if AI fallback also fails
  console.log('[fallback] Using static safety net');
  if (/laptop/.test(q)) return {
    intro: 'Top laptops available right now.',
    options: [
      { name: 'Apple MacBook Air M3',  category: 'battery',     why: 'Apple M3 chip, 18h battery, 13.6-inch Liquid Retina — lightest MacBook with all-day battery.', pickIf: 'you want all-day battery life in a sub-1.3kg build.', _score: 4 },
      { name: 'Dell XPS 15 (2025)',    category: 'productivity', why: 'Intel Core i7-13700H, 16GB RAM, 15.6-inch 3.5K OLED — best display for developers and creators.', pickIf: 'you need a high-res OLED display for coding or video editing.', _score: 4 },
      { name: 'ASUS ZenBook 14 OLED',  category: 'portability',  why: 'AMD Ryzen 7, 14-inch 2.8K OLED, 1.39kg — best OLED in a compact travel-ready form.', pickIf: 'you want an OLED display in a laptop under 1.5kg.', _score: 4 },
    ],
    decideLines: ['Best battery → Apple MacBook Air M3', 'Best display → Dell XPS 15 (2025)', 'Most portable → ASUS ZenBook 14 OLED'],
  };
  return {
    intro: 'Top smartphones available right now.',
    options: [
      { name: 'Samsung Galaxy S24 Ultra', category: 'camera',       why: '200MP camera, Snapdragon 8 Gen 3, 5000mAh, 45W charging — best zoom and S Pen in Android.', pickIf: 'you want the best Android camera with built-in S Pen.', _score: 4 },
      { name: 'Apple iPhone 15 Pro',      category: 'productivity',  why: 'A17 Pro chip, 48MP main camera, titanium frame, USB-C 3.0 — fastest mobile chip available.', pickIf: 'you want the fastest chip and best iOS app ecosystem.', _score: 4 },
      { name: 'OnePlus 12',               category: 'value',         why: 'Snapdragon 8 Gen 3, 5400mAh, 100W SUPERVOOC, 6.82-inch 120Hz AMOLED — best specs per rupee.', pickIf: 'you want flagship specs with the fastest charging under ₹65k.', _score: 4 },
    ],
    decideLines: ['Best camera → Samsung Galaxy S24 Ultra', 'Best performance → Apple iPhone 15 Pro', 'Best value → OnePlus 12'],
  };
}
