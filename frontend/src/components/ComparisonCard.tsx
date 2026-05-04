import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap } from 'lucide-react';

interface ComparisonCardProps {
  bestModel: string;
  reason: string;
}

const ComparisonCard: React.FC<ComparisonCardProps> = ({ bestModel, reason }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-gradient-x"
    >
      <div className="bg-background/90 backdrop-blur-2xl rounded-[15px] p-8 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Trophy size={40} className="text-white" />
        </div>
        
        <div className="flex-grow text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <Zap size={16} className="text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-bold text-purple-400 uppercase tracking-widest">Top Performer</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3">
            {bestModel} <span className="text-muted-foreground font-normal">is winning the AEO race</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            {reason}
          </p>
        </div>

        <div className="flex-shrink-0">
          <button className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-opacity-90 transition-all active:scale-95">
            Optimize for {bestModel}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ComparisonCard;