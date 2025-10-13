import React from 'react';
import type { Article } from '../types';

interface AnswerCardProps {
  answer: string;
  sources: Article[];
  onTranslate: (articleId: string) => void;
}

const AnswerCard: React.FC<AnswerCardProps> = ({ answer, sources, onTranslate }) => {
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
                    Sources ({sources.length})
                 </h4>
                 <div className="space-y-4">
                    {sources.map((source) => (
                        <div key={source.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                           <h5 className="font-semibold text-blue-700 mb-2 text-base">
                             <a 
                                href={source.pubmedUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline"
                                aria-label={`Read '${source.title}' on PubMed`}
                             >
                                {source.title}
                             </a>
                           </h5>
                           
                           <div className={`grid grid-cols-1 ${source.translatedAbstract ? 'md:grid-cols-2' : ''} gap-x-6 gap-y-4`}>
                                <div>
                                    <h6 className="text-md font-semibold mb-1 text-slate-800">Abstract</h6>
                                    <p className="whitespace-pre-wrap break-words leading-relaxed text-sm text-slate-600 bg-white p-3 rounded-md border border-slate-100">
                                      {source.abstract}
                                    </p>
                                </div>
                                {source.translatedAbstract && (
                                    <div>
                                        <h6 className="text-md font-semibold mb-1 text-sky-700">초록 (Korean)</h6>
                                        <p className="whitespace-pre-wrap break-words leading-relaxed text-sm text-slate-600 bg-white p-3 rounded-md border border-slate-100">
                                          {source.translatedAbstract}
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Actions Section */}
                            <div className="mt-4 pt-3 border-t border-slate-200">
                                <div className="flex justify-end items-center">
                                    {!source.translatedAbstract && (
                                        <button
                                            onClick={() => onTranslate(source.id)}
                                            disabled={source.isTranslating}
                                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors duration-200"
                                        >
                                            {source.isTranslating ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Translating...
                                                </>
                                            ) : (
                                                'Translate to Korean'
                                            )}
                                        </button>
                                    )}
                                </div>
                                {source.translationError && (
                                    <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
                                      <div className="flex justify-end">
                                        <span><strong>Translation Error:</strong> {source.translationError}</span>
                                      </div>
                                    </div>
                                )}
                           </div>
                        </div>
                    ))}
                 </div>
            </div>
        )}
    </div>
  );
};

export default AnswerCard;