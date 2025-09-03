import React from 'react';
import type { SortOption } from '../services/pubmedService';

interface SortOptionsProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  disabled: boolean;
}

const SortOptions: React.FC<SortOptionsProps> = ({ currentSort, onSortChange, disabled }) => {
  const options: { value: SortOption; label: string }[] = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'pubdate', label: 'Most Recent' },
  ];

  return (
    <div className="flex justify-center items-center space-x-4 mt-4" role="radiogroup" aria-labelledby="sort-by-label">
      <span id="sort-by-label" className="text-sm font-medium text-slate-600">Sort by:</span>
      {options.map((option) => (
        <label key={option.value} className={`flex items-center space-x-2 cursor-pointer transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-blue-600'}`}>
          <input
            type="radio"
            name="sort"
            value={option.value}
            checked={currentSort === option.value}
            onChange={() => onSortChange(option.value)}
            disabled={disabled}
            className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out focus:ring-blue-500 border-gray-300"
          />
          <span className="text-sm">{option.label}</span>
        </label>
      ))}
    </div>
  );
};

export default SortOptions;
