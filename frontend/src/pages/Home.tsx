import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBar from '../components/SearchBar';
import ModelCard from '../components/ModelCard';
import ComparisonCard from '../components/ComparisonCard';
import StrategyCard from '../components/StrategyCard';
import { BrainCircuit, ShieldCheck, Globe, BarChart3, AlertCircle } from 'lucide-react';
import { analyzeQuery } from '../services/api.js';

// ── Types matching the backend response shape ─────────────────────────────────

interface RankingItem {
  name: string;
  rank: number;
}

interface ModelResult {
  ranking: RankingItem[];
  competitors: string[];
  insights: string;
  suggestions: string[];
  visibilityScore: number;
  improvementPotential: string;
}

interface Comparison {
  bestModel: string;
  reason: string;
}

interface FinalStrategy {
  recommendedAction: string;
  focusKeywords: string[];
  positioning: string;
  priceStrategy: string;
  quickWin: string;
}

interface ApiData {
  groq: ModelResult;
  gpt: ModelResult;
  gemini: ModelResult;
  comparison: Comparison;
  finalStrategy: FinalStrategy;
}

// ── Map backend model data → ModelCard props ──────────────────────────────────

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
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await analyzeQuery(query);

      if (!response.success) {
        throw new Error('Analysis failed. Please try again.');
      }

      setResult(response.data);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

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
            <button className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold transition-all">
              Sign In
            </button>
          </nav>
        </div>
      </header>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
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

          <SearchBar onSearch={handleSearch} isLoading={isLoading} />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500"
          >
            <div className="flex items-center gap-2"><ShieldCheck size={20} /> <span>Enterprise Grade</span></div>
            <div className="flex items-center gap-2"><Globe size={20} /> <span>Global Coverage</span></div>
            <div className="flex items-center gap-2"><BarChart3 size={20} /> <span>Real-time Data</span></div>
          </motion.div>
        </section>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-4 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full animate-pulse"></div>
              </div>
              <p className="mt-8 text-lg font-medium text-muted-foreground animate-pulse">
                Analyzing with Groq, GPT, Gemini...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
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

        {/* Results Section */}
        {result && (
          <div ref={resultsRef} className="max-w-7xl mx-auto px-6 space-y-12 scroll-mt-32">

            {/* ── 1. Final Strategy — hero position ── */}
            <StrategyCard strategy={result.finalStrategy} />

            {/* ── 2. Model Cards ── */}
            {/* Best model spans full width; supporting models share the row below */}
            <div className="space-y-4">
              {/* Determine which key maps to the best model */}
              {(() => {
                const bestKey = result.comparison.bestModel.toLowerCase() as 'groq' | 'gpt' | 'gemini';
                const models: Array<{ key: 'groq' | 'gpt' | 'gemini'; label: string }> = [
                  { key: 'groq',   label: 'Groq (Llama 3)' },
                  { key: 'gpt',    label: 'GPT-style'      },
                  { key: 'gemini', label: 'Gemini-style'   },
                ];
                const best       = models.find((m) => m.key === bestKey) ?? models[0];
                const supporting = models.filter((m) => m.key !== bestKey);

                return (
                  <>
                    {/* Best model — full width */}
                    <ModelCard
                      model={toModelCardProps(best.label, result[best.key])}
                      index={0}
                      isBest
                    />
                    {/* Supporting models — 2-column row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {supporting.map((m, i) => (
                        <ModelCard
                          key={m.key}
                          model={toModelCardProps(m.label, result[m.key])}
                          index={i + 1}
                        />
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ── 3. Comparison ── */}
            <ComparisonCard
              bestModel={result.comparison.bestModel}
              reason={result.comparison.reason}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-12 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <BrainCircuit className="text-purple-500" size={20} />
            <span className="font-bold">AEO Engine</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 AEO Multi-AI Diagnostic Engine. All rights reserved.
          </p>
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
