import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Trophy } from 'lucide-react';

interface ModelResult {
  name: string;
  rankings: string[];
  insights: string;
  suggestions: string[];
}

interface ModelCardProps {
  model: ModelResult;
  index: number;
  isBest?: boolean;
}

const ModelCard: React.FC<ModelCardProps> = ({ model, index, isBest = false }) => {
  // Supporting cards show only top 2 suggestions and a truncated insight
  const visibleSuggestions = isBest ? model.suggestions : model.suggestions.slice(0, 2);

  if (isBest) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        // Spans full width on its own row — handled by the grid in Home
        className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-purple-500 to-blue-500 shadow-[0_0_40px_-8px_rgba(168,85,247,0.4)]"
      >
        <div className="bg-[#0d0d14] rounded-[14px] p-8">
          {/* Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-md shadow-purple-500/30">
                <Trophy size={20} className="text-white" />
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-0.5">
                  🏆 Recommended Model
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight">{model.name}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Rankings */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Top Rankings
              </p>
              <div className="space-y-2">
                {model.rankings.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-foreground/90">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-400">
                      {i + 1}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Insights
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{model.insights}</p>
            </div>

            {/* Suggestions */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Suggestions
              </p>
              <ul className="space-y-2">
                {visibleSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <CheckCircle2 size={14} className="mt-1 text-emerald-500 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Supporting / collapsed card ──────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative bg-card/30 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all duration-300"
    >
      {/* Supporting label */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
        Supporting Insights
      </p>

      <h3 className="text-base font-bold text-foreground/80 tracking-tight mb-5">{model.name}</h3>

      <div className="space-y-5">
        {/* Top ranking only */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Top Ranking
          </p>
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
              1
            </span>
            {model.rankings[0]}
          </div>
        </div>

        {/* Top 2 suggestions only */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Key Suggestions
          </p>
          <ul className="space-y-1.5">
            {visibleSuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/60">
                <CheckCircle2 size={12} className="mt-0.5 text-emerald-500/60 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default ModelCard;
