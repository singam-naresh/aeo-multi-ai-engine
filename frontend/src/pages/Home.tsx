import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import ModelCard from '../components/ModelCard';
import ComparisonCard from '../components/ComparisonCard';
import StrategyCard from '../components/StrategyCard';
import { BrainCircuit, ShieldCheck, Globe, BarChart3, AlertCircle, LogOut, User, Info, Sparkles } from 'lucide-react';
import { analyzeQuery, askQuery, getStoredUser, clearToken } from '../services/api.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RankingItem { name: string; rank: number; }

interface ModelResult {
  ranking: RankingItem[];
  competitors: string[];
  insights: string;
  suggestions: string[];
  visibilityScore: number;
  improvementPotential: string;
}

interface Comparison { bestModel: string; reason: string; }

interface FinalStrategy {
  recommendedAction: string;
  focusKeywords: string[];
  positioning: string;
  priceStrategy: string | null;
  quickWin: string;
  confidence?: number;
  evidence?: string;
  groundSignals?: string[];
}

interface ApiData {
  groq:       ModelResult | null;
  gpt:        ModelResult | null;
  gemini:     ModelResult | null;
  comparison: Comparison  | null;
  finalStrategy: FinalStrategy;
}

// ── Loading messages ──────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Analyzing Groq...',
  'Comparing GPT...',
  'Evaluating Gemini...',
  'Building strategy...',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toModelCardProps(name: string, model: ModelResult) {
  return {
    name,
    rankings: model.ranking.slice(0, 3).map((r) => r.name),
    insights: model.insights,
    suggestions: model.suggestions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading]         = useState(false);
  const [result, setResult]               = useState<ApiData | null>(null);
  const [aiAnswer, setAiAnswer]           = useState<{ answer: string; type: string } | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [pendingQuery, setPendingQuery]   = useState('');
  const [currentUser, setCurrentUser]     = useState(getStoredUser());

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
  };

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef     = useRef<HTMLDivElement | null>(null);

  const modelRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    groq:   useRef<HTMLDivElement | null>(null),
    gpt:    useRef<HTMLDivElement | null>(null),
    gemini: useRef<HTMLDivElement | null>(null),
  };

  useEffect(() => {
    if (!isLoading) return;
    setLoadingMsgIdx(0);
    const id = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1200);
    return () => clearInterval(id);
  }, [isLoading]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    setAiAnswer(null);
    setError(null);
    setSelectedModel(null);

    try {
      // Run both calls in parallel — /api/ask for direct answer, /api/analyze for strategy
      const [askResponse, analyzeResponse] = await Promise.allSettled([
        askQuery(query.trim()),
        analyzeQuery(query.trim()),
      ]);

      // Direct AI answer
      if (askResponse.status === 'fulfilled' && askResponse.value?.success) {
        setAiAnswer(askResponse.value.data);
      }

      // Strategy data
      if (analyzeResponse.status === 'fulfilled' && analyzeResponse.value?.success) {
        setResult(analyzeResponse.value.data);
      } else if (askResponse.status === 'rejected' && analyzeResponse.status === 'rejected') {
        throw new Error('Analysis failed. Please try again.');
      }

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeywordTrigger = (keyword: string) => {
    setPendingQuery(keyword);
    setTimeout(() => searchInputRef.current?.focus(), 400);
  };

  const handleOptimizeModel = (modelName: string) => {
    const key = modelName.toLowerCase() as 'groq' | 'gpt' | 'gemini';
    setSelectedModel(key);
    setTimeout(() => {
      modelRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Safe: null when comparison is absent (informational queries)
  const bestKey = result?.comparison?.bestModel?.toLowerCase() as 'groq' | 'gpt' | 'gemini' | undefined;

  // True when we have full multi-model data (product / platform queries)
  const hasModelData = !!(result?.comparison && result?.groq && result?.gpt && result?.gemini);

  const modelList: Array<{ key: 'groq' | 'gpt' | 'gemini'; label: string }> = [
    { key: 'groq',   label: 'Groq (Llama 3)' },
    { key: 'gpt',    label: 'GPT-style'       },
    { key: 'gemini', label: 'Gemini-style'    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-purple-500/30">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">AEO Engine</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">API Docs</a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Link to="/analytics" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Analytics</Link>
            {currentUser ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User size={13} />
                  {currentUser.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold transition-all"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </Link>
                <Link to="/register" className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg text-sm font-semibold transition-all">
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="pt-32 pb-24">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 text-center mb-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block px-4 py-1.5 mb-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest">
              Next-Gen AI Optimization
            </span>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              AEO Multi-AI <br />Diagnostic Engine
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Analyze how AI ranks your product — and get the exact strategy to win the future of search.
            </p>
          </motion.div>

          <SearchBar
            onSearch={handleSearch}
            isLoading={isLoading}
            inputRef={searchInputRef}
            externalQuery={pendingQuery}
            onExternalQueryConsumed={() => setPendingQuery('')}
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500"
          >
            <div className="flex items-center gap-2"><ShieldCheck size={20} /><span>Enterprise Grade</span></div>
            <div className="flex items-center gap-2"><Globe size={20} /><span>Global Coverage</span></div>
            <div className="flex items-center gap-2"><BarChart3 size={20} /><span>Real-time Data</span></div>
          </motion.div>
        </section>

        {/* Loading */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-4 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full animate-pulse" />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingMsgIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="mt-8 text-lg font-medium text-muted-foreground"
                >
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto px-6 mb-8"
            >
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <AlertCircle size={20} className="flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ── */}
        {(result || aiAnswer) && (
          <div ref={resultsRef} className="max-w-7xl mx-auto px-6 space-y-12 scroll-mt-32">

            {/* ── AI Response block — always shown first ── */}
            {aiAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl border border-white/8 bg-card/40 backdrop-blur-xl overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-purple-400">AI Response</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{aiAnswer.type} query</p>
                  </div>
                </div>
                {/* Answer body */}
                <div className="px-6 py-5">
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {aiAnswer.answer}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Informational query — no model data, show clean message */}
            {result && !hasModelData && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-start gap-4 p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Info size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">
                    Informational Query
                  </p>
                  <p className="text-base font-semibold text-white mb-1">
                    {result.finalStrategy.recommendedAction}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.finalStrategy.positioning}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Strategy card — shown for all query types that have a finalStrategy */}
            {result?.finalStrategy && (
              <StrategyCard
                strategy={result.finalStrategy}
                onKeywordClick={handleKeywordTrigger}
                onApplyStrategy={handleKeywordTrigger}
              />
            )}

            {/* Model cards + Comparison — only when full model data is present */}
            {result && hasModelData && bestKey && result.groq && result.gpt && result.gemini && (
              <>
                {/* Model Cards */}
                <div className="space-y-4">
                  {(() => {
                    const best       = modelList.find((m) => m.key === bestKey) ?? modelList[0];
                    const supporting = modelList.filter((m) => m.key !== bestKey);

                    const isHighlighted = (key: string) =>
                      selectedModel === null ? true : selectedModel === key;

                    // Safe access — we've already confirmed these are non-null above
                    const modelData: Record<string, ModelResult> = {
                      groq:   result.groq,
                      gpt:    result.gpt,
                      gemini: result.gemini,
                    };

                    return (
                      <>
                        <ModelCard
                          model={toModelCardProps(best.label, modelData[best.key])}
                          index={0}
                          isBest
                          isHighlighted={isHighlighted(best.key)}
                          cardRef={modelRefs[best.key]}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {supporting.map((m, i) => (
                            <ModelCard
                              key={m.key}
                              model={toModelCardProps(m.label, modelData[m.key])}
                              index={i + 1}
                              isHighlighted={isHighlighted(m.key)}
                              cardRef={modelRefs[m.key]}
                            />
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Comparison — safe: only rendered when result.comparison is non-null */}
                {result.comparison && (
                  <ComparisonCard
                    bestModel={result.comparison.bestModel}
                    reason={result.comparison.reason}
                    onOptimizeModel={handleOptimizeModel}
                  />
                )}
              </>
            )}

          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-12 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <BrainCircuit className="text-purple-500" size={20} />
            <span className="font-bold">AEO Engine</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 AEO Multi-AI Diagnostic Engine. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
