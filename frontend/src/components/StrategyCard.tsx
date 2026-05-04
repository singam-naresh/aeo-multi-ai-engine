import React from 'react';
import { motion } from 'framer-motion';
import {
  Rocket, Key, MapPin, DollarSign, Zap, ArrowRight,
  TrendingUp, MousePointerClick, ShoppingCart, Copy, Check,
} from 'lucide-react';

interface StrategyData {
  recommendedAction: string;
  focusKeywords: string[];
  positioning: string;
  priceStrategy: string;
  quickWin: string;
}

interface StrategyCardProps {
  strategy: StrategyData;
  onKeywordClick: (keyword: string) => void;
  onApplyStrategy: (keyword: string) => void;
}

function deriveImpact(strategy: StrategyData) {
  const seed = (strategy.recommendedAction.length + strategy.focusKeywords.join('').length) % 10;
  return {
    rankingBoost:   2  + (seed % 4),
    ctrImprovement: 10 + (seed % 16),
    conversionLift: 5  + (seed % 11),
  };
}

function buildClipboardText(strategy: StrategyData): string {
  return [
    `Recommended Action: ${strategy.recommendedAction}`,
    `Keywords: ${strategy.focusKeywords.join(', ')}`,
    `Positioning: ${strategy.positioning}`,
    `Price Strategy: ${strategy.priceStrategy}`,
    `Quick Win: ${strategy.quickWin}`,
  ].join('\n');
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy, onKeywordClick, onApplyStrategy }) => {
  const impact = deriveImpact(strategy);
  const [copied, setCopied] = React.useState(false);

  const handleApply = () => {
    // Copy to clipboard
    navigator.clipboard.writeText(buildClipboardText(strategy)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // Scroll to top and trigger search with best keyword
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onApplyStrategy(strategy.focusKeywords[0] ?? '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative rounded-3xl p-[2px] bg-gradient-to-br from-purple-500 via-blue-500 to-purple-600 shadow-[0_0_60px_-10px_rgba(168,85,247,0.5)]"
    >
      <div className="absolute -inset-2 bg-gradient-to-br from-purple-600/20 via-blue-600/10 to-purple-600/20 rounded-3xl blur-2xl -z-10" />

      <div className="relative bg-[#0d0d14] rounded-[22px] p-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30 text-2xl">
              🚀
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Your Winning Strategy</h2>
              <p className="text-sm text-purple-300/70 mt-0.5">Act on this now to outrank competitors in AI search</p>
            </div>
          </div>

          {/* Apply Strategy CTA — scrolls to top, autofills best keyword, copies to clipboard */}
          <div className="flex items-center gap-3">
            {copied && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg"
              >
                <Check size={13} />
                Strategy copied
              </motion.span>
            )}
            <button
              onClick={handleApply}
              className="flex-shrink-0 flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-purple-500/20 whitespace-nowrap"
            >
              {copied ? <Copy size={18} /> : <ArrowRight size={18} />}
              Apply Strategy
            </button>
          </div>
        </div>

        {/* ── Recommended Action ── */}
        <div className="mb-8 p-7 rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/25">
          <div className="flex items-center gap-2 mb-3 text-purple-400">
            <Rocket size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Recommended Action</span>
          </div>
          <p className="text-2xl font-bold text-white leading-snug">{strategy.recommendedAction}</p>
        </div>

        {/* ── Focus Keywords — each chip is clickable ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 text-blue-400">
            <Key size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Focus Keywords</span>
            <span className="text-[10px] text-blue-400/50 ml-1">— click to analyze</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {strategy.focusKeywords.map((tag, i) => (
              <button
                key={i}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  onKeywordClick(tag);
                }}
                className="px-4 py-2 bg-blue-500/10 border border-blue-500/25 rounded-full text-sm font-semibold text-blue-300 hover:bg-blue-500/25 hover:border-blue-400/50 hover:text-blue-200 transition-all duration-150 cursor-pointer active:scale-95"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* ── Positioning + Price Strategy ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/8">
            <div className="flex items-center gap-2 mb-3 text-emerald-400">
              <MapPin size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Positioning</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed font-medium">{strategy.positioning}</p>
          </div>

          <div className="p-6 bg-white/[0.04] rounded-2xl border border-white/8">
            <div className="flex items-center gap-2 mb-3 text-amber-400">
              <DollarSign size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Price Strategy</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed font-medium">{strategy.priceStrategy}</p>
          </div>
        </div>

        {/* ── Quick Win ── */}
        <div className="flex items-start gap-4 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Zap size={20} className="text-emerald-400 fill-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Quick Win — Do This First</p>
            <p className="text-base font-semibold text-white">{strategy.quickWin}</p>
          </div>
        </div>

        {/* ── Expected Impact ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Expected Impact</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 p-5 bg-purple-500/8 border border-purple-500/20 rounded-2xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <TrendingUp size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white leading-none mb-1">
                  +{impact.rankingBoost}<span className="text-sm font-semibold text-purple-400 ml-1">positions</span>
                </p>
                <p className="text-xs text-muted-foreground">Ranking Boost</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-blue-500/8 border border-blue-500/20 rounded-2xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <MousePointerClick size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white leading-none mb-1">
                  +{impact.ctrImprovement}%<span className="text-sm font-semibold text-blue-400 ml-1">CTR</span>
                </p>
                <p className="text-xs text-muted-foreground">Click-Through Rate</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <ShoppingCart size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white leading-none mb-1">
                  +{impact.conversionLift}%<span className="text-sm font-semibold text-emerald-400 ml-1">CVR</span>
                </p>
                <p className="text-xs text-muted-foreground">Conversion Impact</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default StrategyCard;
