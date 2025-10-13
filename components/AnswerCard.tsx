import React from 'react';
import type { Article } from '../types';

interface AnswerCardProps {
  answer: string;
  sources: Article[];
}

const AnswerCard: React.FC<AnswerCardProps> = ({ answer, sources }) => {
  return (
    <div className="bg-white shadow-lg rounded-xl p-6 my-4 border border-blue-200 transition-shadow duration-300">
        {/* Answer Section */}
        <div>
            <h3 className="text-xl font-bold text-blue-800 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Answer
            </h3>
            <p className="bg-slate-50 p-4 rounded-md border border-slate-200 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
                {answer}
            </p>
        </div>

        {/* Sources Section */}
        {sources && sources.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-200">
                 <h4 className="text-lg font-semibold mb-3 text-slate-800">
                    Sources
                 </h4>
                 <ul className="list-decimal list-inside space-y-2">
                    {sources.map((source) => (
                        <li key={source.id} className="text-slate-600">
                            <a 
                                href={source.pubmedUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                                {source.title}
                            </a>
                        </li>
                    ))}
                 </ul>
            </div>
        )}
    </div>
  );
};

export default AnswerCard;
