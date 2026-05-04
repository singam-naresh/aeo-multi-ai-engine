import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  // Lifted ref so parent can focus + set value programmatically
  inputRef?: React.RefObject<HTMLInputElement>;
  externalQuery?: string;
  onExternalQueryConsumed?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  inputRef,
  externalQuery,
  onExternalQueryConsumed,
}) => {
  const [query, setQuery] = React.useState('');

  // When parent pushes an external query (keyword chip / apply strategy),
  // sync it into local state and fire the search immediately.
  React.useEffect(() => {
    if (externalQuery !== undefined && externalQuery !== '') {
      setQuery(externalQuery);
      onSearch(externalQuery);
      onExternalQueryConsumed?.();
    }
  }, [externalQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-3xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-focus-within:opacity-70"></div>
        <div className="relative flex items-center bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <div className="pl-6 text-muted-foreground">
            <Search size={20} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter product query (e.g. best running shoes for beginners)"
            className="w-full bg-transparent py-6 px-4 text-lg focus:outline-none text-foreground placeholder:text-muted-foreground/50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="mr-3 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles size={18} />
                <span>Analyze</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default SearchBar;
