import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, BarChart3, Search, Trophy, Zap, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AnalyticsData {
  totalQueries: number;
  topQueries:   { query: string; count: number }[];
  topIntents:   { intent: string; count: number }[];
  topModels:    { model: string; count: number }[];
}

export default function Analytics() {
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/analytics');
      const json = await res.json();
      if (!json.success) throw new Error('Failed to load analytics');
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Could not load analytics. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">AEO Engine</span>
          </Link>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold transition-all"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </header>

      <main className="pt-32 pb-24 max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-10">
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400">
              <BarChart3 size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Usage insights from the AEO diagnostic engine</p>
            </div>
          </div>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-8">
            {/* Total Queries */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Total Queries Analyzed</p>
              <p className="text-6xl font-extrabold text-white">{data.totalQueries.toLocaleString()}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top Queries */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-card/40 border border-white/5 rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-5 text-blue-400">
                  <Search size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Most Searched</span>
                </div>
                {data.topQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <ul className="space-y-3">
                    {data.topQueries.slice(0, 8).map((q, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground/80 truncate">{q.query}</span>
                        <span className="flex-shrink-0 text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                          {q.count}×
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>

              {/* Top Intents */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-card/40 border border-white/5 rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-5 text-emerald-400">
                  <Zap size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Top Intents</span>
                </div>
                {data.topIntents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <ul className="space-y-3">
                    {data.topIntents.map((item, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground/80 capitalize">{item.intent}</span>
                        <span className="flex-shrink-0 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          {item.count}×
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>

              {/* Top Models */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="bg-card/40 border border-white/5 rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-5 text-amber-400">
                  <Trophy size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Winning Models</span>
                </div>
                {data.topModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <ul className="space-y-3">
                    {data.topModels.map((item, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground/80 capitalize">{item.model}</span>
                        <span className="flex-shrink-0 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {item.count}×
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
