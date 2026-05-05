import React from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, ArrowLeft } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">AEO Engine</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center pt-20 px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🚧</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-3">{title}</h1>
          <p className="text-muted-foreground mb-8">
            {description ?? 'This section is coming soon. We\'re working on it.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-all"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
