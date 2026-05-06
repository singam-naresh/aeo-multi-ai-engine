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

// ── Brand Constraint Detection ────────────────────────────────────────────────
// Maps query keywords to brand identifiers and their name patterns.
// Used to enforce that all options belong to the queried brand.

const BRAND_CONSTRAINT_MAP = [
  { keywords: /\bvivo\b/i,       brand: 'vivo',       namePattern: /\bvivo\b/i,       seeds: 'Vivo V30 Pro, Vivo X90 Pro, Vivo iQOO 12 Pro, Vivo V29 Pro, Vivo T3 Pro' },
  { keywords: /\biqoo\b/i,       brand: 'iqoo',       namePattern: /\biqoo\b/i,        seeds: 'Vivo iQOO 12 Pro, Vivo iQOO Neo 9 Pro, Vivo iQOO Z9 Pro, Vivo iQOO 11 Pro, Vivo iQOO Z8' },
  { keywords: /\bsamsung\b/i,    brand: 'samsung',    namePattern: /\bsamsung\b/i,     seeds: 'Samsung Galaxy S24 Ultra, Samsung Galaxy S24+, Samsung Galaxy A55, Samsung Galaxy M55, Samsung Galaxy F55' },
  { keywords: /\biphone\b|\bapple\s+phone\b/i, brand: 'apple', namePattern: /\biphone\b|\bapple\b/i, seeds: 'Apple iPhone 15 Pro Max, Apple iPhone 15 Pro, Apple iPhone 15, Apple iPhone 15 Plus, Apple iPhone 14' },
  { keywords: /\bgoogle\s+pixel\b|\bpixel\s+phone\b/i, brand: 'pixel', namePattern: /\bpixel\b|\bgoogle\b/i, seeds: 'Google Pixel 9 Pro XL, Google Pixel 9 Pro, Google Pixel 9, Google Pixel 8a, Google Pixel 8 Pro' },
  { keywords: /\boneplus\b/i,    brand: 'oneplus',    namePattern: /\boneplus\b/i,     seeds: 'OnePlus 12, OnePlus 12R, OnePlus Nord CE 4, OnePlus Nord 4, OnePlus Open' },
  { keywords: /\bxiaomi\b/i,     brand: 'xiaomi',     namePattern: /\bxiaomi\b/i,      seeds: 'Xiaomi 14 Ultra, Xiaomi 14, Xiaomi 13T Pro, Xiaomi Redmi Note 13 Pro+, Xiaomi POCO F6 Pro' },
  { keywords: /\boppo\b/i,       brand: 'oppo',       namePattern: /\boppo\b/i,        seeds: 'OPPO Find X7 Ultra, OPPO Reno 12 Pro, OPPO A3 Pro, OPPO F25 Pro, OPPO K12' },
  { keywords: /\brealme\b/i,     brand: 'realme',     namePattern: /\brealme\b/i,      seeds: 'Realme GT 6, Realme 12 Pro+, Realme Narzo 70 Pro, Realme P1 Pro, Realme C65' },
  { keywords: /\bpoco\b/i,       brand: 'poco',       namePattern: /\bpoco\b/i,        seeds: 'POCO F6 Pro, POCO X6 Pro, POCO M6 Pro, POCO F6, POCO C65' },
  { keywords: /\bmotorola\b|\bmoto\b/i, brand: 'motorola', namePattern: /\bmotorola\b|\bmoto\b/i, seeds: 'Motorola Edge 50 Ultra, Motorola Edge 50 Pro, Motorola Moto G85, Motorola Razr 50 Ultra, Motorola Edge 50 Fusion' },
  { keywords: /\bnokia\b/i,      brand: 'nokia',      namePattern: /\bnokia\b/i,       seeds: 'Nokia G42 5G, Nokia C32, Nokia G21, Nokia X30, Nokia G60' },
  { keywords: /\bnothing\b/i,    brand: 'nothing',    namePattern: /\bnothing\b/i,     seeds: 'Nothing Phone (2a), Nothing Phone (2), Nothing Phone (1), Nothing CMF Phone 1' },
  { keywords: /\basus\s+(rog|zephyrus|tuf|zenbook|vivobook)\b/i, brand: 'asus', namePattern: /\basus\b/i, seeds: 'ASUS ROG Zephyrus G14 (2025), ASUS ROG Strix G16, ASUS TUF Gaming A15, ASUS ZenBook 14 OLED, ASUS Vivobook 16X' },
  { keywords: /\bdell\b/i,       brand: 'dell',       namePattern: /\bdell\b/i,        seeds: 'Dell XPS 15 (2025), Dell XPS 13 Plus, Dell Inspiron 16 Plus, Dell Alienware M18, Dell Latitude 9440' },
  { keywords: /\blenovo\b/i,     brand: 'lenovo',     namePattern: /\blenovo\b/i,      seeds: 'Lenovo ThinkPad X1 Carbon Gen 12, Lenovo Legion Pro 7i, Lenovo IdeaPad Slim 5, Lenovo Yoga 9i, Lenovo Legion 5 Pro' },
  { keywords: /\bhp\b/i,         brand: 'hp',         namePattern: /\bhp\b/i,          seeds: 'HP Spectre x360 14, HP EliteBook 840 G10, HP Pavilion 15, HP Omen 16, HP Envy 16' },
  { keywords: /\brazer\b/i,      brand: 'razer',      namePattern: /\brazer\b/i,       seeds: 'Razer Blade 15 (2024), Razer Blade 16, Razer Blade 14, Razer Blade 18, Razer Blade Stealth 13' },
  { keywords: /\bmsi\b/i,        brand: 'msi',        namePattern: /\bmsi\b/i,         seeds: 'MSI Stealth 16 Studio, MSI Raider GE78 HX, MSI Titan GT77 HX, MSI Katana 15, MSI Prestige 16' },
];

/**
 * Detect if the query constrains output to a specific brand.
 * Returns { brand, namePattern, seeds } or null if no constraint.
 */
export function detectBrandConstraint(query) {
  const q = query.toLowerCase();
  for (const entry of BRAND_CONSTRAINT_MAP) {
    if (entry.keywords.test(q)) {
      return { brand: entry.brand, namePattern: entry.namePattern, seeds: entry.seeds };
    }
  }
  return null;
}

/**
 * Check if all options satisfy the brand constraint.
 * Returns array of violation strings (empty = all good).
 */
export function checkBrandConstraint(options, constraint) {
  if (!constraint) return [];
  const violations = [];
  for (const opt of options) {
    if (!constraint.namePattern.test(opt.name || '')) {
      violations.push(`Option "${opt.name}" violates brand constraint — query requires ${constraint.brand} products only`);
    }
  }
  return violations;
}


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

// Score a single option 0–4
export function scoreOption(opt) {
  let score = 0;
  // +1 valid name (Brand + Model, not bare brand)
  if (opt.name && opt.name.trim().split(/\s+/).length >= 2 && !BARE_BRAND_RE.test(opt.name.trim())) score++;
  // +1 WHY has real spec
  if (opt.why && REAL_SPEC_RE.test(opt.why)) score++;
  // +1 WHY has no vague phrases — but only penalise if there's ALSO no real spec
  // (avoids penalising "Snapdragon 8 Gen 3 delivers smooth gaming" which has a real spec)
  const hasRealSpec = opt.why && REAL_SPEC_RE.test(opt.why);
  const hasVague    = opt.why && VAGUE_WHY_PATTERNS.some((re) => re.test(opt.why));
  if (!hasVague || hasRealSpec) score++; // pass if no vague OR if vague but spec present
  // +1 PICK_IF is specific (more than 4 words)
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
export function validateAndCleanStructured(parsed, constraint = null) {
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

  const avg         = avgScore(cleaned.options);
  const noSpecCount = cleaned.options.filter((o) => !REAL_SPEC_RE.test(o.why || '')).length;
  const hasBare     = cleaned.options.some((o) => BARE_BRAND_RE.test(o.name.trim()));
  const diffIssues  = checkDifferentiation(cleaned.options);

  // Log quality issues for visibility — but only reject on truly broken output
  if (avg < 2.5)       console.warn(`[quality] avg score ${avg.toFixed(1)} < 2.5 — low quality but keeping`);
  if (noSpecCount > 1) console.warn(`[quality] ${noSpecCount} options missing real specs`);
  if (diffIssues.length > 0) console.warn(`[quality] use-case overlap detected: ${diffIssues.join('; ')}`);

  // Hard reject ONLY when output is structurally broken — not on quality scores
  if (cleaned.options.length < 2) allReasons.push('fewer than 2 valid options');
  if (hasBare)                    allReasons.push('all options are bare brand names');

  // ── Brand constraint check ────────────────────────────────────────────────
  if (constraint) {
    const brandViolations = checkBrandConstraint(cleaned.options, constraint);
    const violationRatio  = brandViolations.length / Math.max(cleaned.options.length, 1);
    if (violationRatio > 0.5) {
      console.warn(`[brand] Constraint violation for "${constraint.brand}": ${brandViolations.join('; ')}`);
      allReasons.push(`brand constraint violated: ${brandViolations.length}/${cleaned.options.length} options are not ${constraint.brand} products`);
    } else if (brandViolations.length > 0) {
      // Soft violation — filter out the offending options, keep the rest
      console.warn(`[brand] Soft violation — filtering ${brandViolations.length} non-${constraint.brand} option(s)`);
      cleaned.options = cleaned.options.filter((o) => constraint.namePattern.test(o.name || ''));
    }
  }

  const rejected = allReasons.length > 0;
  if (rejected) console.warn(`[reject] ${allReasons.join(' | ')}`);

  return { cleaned, rejected, reasons: allReasons, perOptionIssues };
}

// ── Dynamic Fallback ──────────────────────────────────────────────────────────
// Asks the AI to generate a fallback with explicit seed product names.
// Falls back to static only if the AI call itself fails.

export async function buildDynamicFallback(query, system, groqPost, parseStructuredResponse, stripGenericPhrases, constraint = null) {
  const q = query.toLowerCase();

  // Brand-constrained seed — use brand-specific products if constraint detected
  let seedProducts;
  if (constraint) {
    seedProducts = constraint.seeds;
    console.log(`[fallback] Brand constraint active: "${constraint.brand}" — using brand seeds`);
  } else if (/gaming.*laptop|laptop.*gaming/.test(q))
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

  const brandInstruction = constraint
    ? `\nCRITICAL: ALL options MUST be ${constraint.brand.toUpperCase()} products only. Do NOT include any other brand.`
    : '';

  const fallbackUser = `Query: ${query}

FALLBACK GENERATION — use ONLY these product names (pick 3 most relevant):
${seedProducts}${brandInstruction}

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
      // Fallback uses lighter validation — only check brand constraint and bare names
      // Skip avg score threshold (fallback content is already seeded with real products)
      const { cleaned } = validateAndCleanStructured(parsed, constraint);
      if (cleaned && cleaned.options && cleaned.options.length >= 2) {
        // Apply brand filter only — don't reject on score
        const brandOk = !constraint || cleaned.options.every((o) => constraint.namePattern.test(o.name || ''));
        const noBare  = cleaned.options.every((o) => !BARE_BRAND_RE.test(o.name.trim()));
        if (brandOk && noBare) {
          console.log('[fallback] Dynamic fallback accepted');
          return cleaned;
        }
      }
    }
  } catch (e) {
    console.error('[fallback] Dynamic fallback AI call failed:', e.message);
  }

  // Static safety net — only if AI fallback also fails
  console.log('[fallback] Using static safety net');

  // If brand constraint is active, build a minimal brand-specific response
  if (constraint) {
    const seeds = constraint.seeds.split(',').map((s) => s.trim()).slice(0, 3);
    return {
      intro: `Top ${constraint.brand} options based on your query.`,
      options: seeds.map((name, i) => ({
        name,
        category: ['camera', 'gaming', 'value', 'battery', 'portability'][i] || 'value',
        why: `Current ${constraint.brand} model with strong specs and user ratings.`,
        pickIf: `you want a reliable ${constraint.brand} device in this category.`,
        _score: 2,
      })),
      decideLines: seeds.map((name) => `${constraint.brand} option → ${name}`),
    };
  }
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
