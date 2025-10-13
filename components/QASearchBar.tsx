import React, { useState } from 'react';

interface QASearchBarProps {
  onAsk: (query: string) => void;
  isLoading: boolean;
}

const QASearchBar: React.FC<QASearchBarProps> = ({ onAsk, isLoading }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      onAsk(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center border-b border-slate-300 py-2">
        <input
          className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none placeholder-slate-400"
          type="text"
          placeholder="e.g., 'What are the latest findings on CRISPR for cancer therapy?'"
          aria-label="Ask a question about your saved articles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
        />
        <button
          className="flex-shrink-0 bg-blue-600 hover:bg-blue-800 border-blue-600 hover:border-blue-800 text-sm border-4 text-white py-1 px-4 rounded-lg disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center transition-colors duration-200"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Answering...
            </>
          ) : 'Ask'}
        </button>
      </div>
    </form>
  );
};

export default QASearchBar;
