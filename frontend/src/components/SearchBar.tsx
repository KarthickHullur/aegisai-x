import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export default function SearchBar({
  placeholder = "Search dashboard metrics, incident logs...",
  onSearch,
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (onSearch) onSearch(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className={`relative w-full ${className}`}>
      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-brand-textSecondary">
        <Search size={16} />
      </div>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-12 py-2 rounded-xl text-sm border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all duration-200 text-brand-textPrimary shadow-soft"
      />
      {/* Keyboard shortcut indicator */}
      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
        <kbd className="hidden sm:inline-flex items-center justify-center h-5 px-1.5 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold text-brand-textSecondary">
          ⌘K
        </kbd>
      </div>
    </form>
  );
}
