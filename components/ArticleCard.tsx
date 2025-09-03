import React from 'react';
import type { Article } from '../types';

interface ArticleCardProps {
  article: Article;
  onTranslate: (articleId: string) => void;
  onSave: (article: Article) => void;
  isSaved: boolean;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onTranslate, onSave, isSaved }) => {
  const hasTranslation = article.translatedTitle && article.translatedAbstract;

  return (
    <article 
      className="bg-white shadow-lg rounded-xl p-6 my-4 border border-slate-200 transition-shadow duration-300 hover:shadow-xl"
      aria-labelledby={`article-title-${article.id}`}
    >
      {/* Header Section */}
      <div>
        <div className="flex items-start justify-between flex-wrap gap-x-4 gap-y-2">
          <h2 id={`article-title-${article.id}`} className="text-2xl font-bold text-blue-800">
            <a href={article.pubmedUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {article.title}
            </a>
          </h2>
          {article.isFree && (
            <span className="flex-shrink-0 bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-1 rounded-full self-start mt-1">
              Free Full Text
            </span>
          )}
        </div>

        {hasTranslation && (
           <h3 className="text-xl font-semibold text-sky-700 mt-2">{article.translatedTitle}</h3>
        )}

        <div className="text-sm text-slate-600 mt-3 space-x-4">
          <span className="font-medium">{article.pubDate}</span>
          <span>
            <strong>Authors:</strong> {article.authors}
          </span>
        </div>
      </div>

      {/* Abstract Section */}
      <div className={`mt-4 pt-4 border-t border-slate-200 ${hasTranslation ? 'grid grid-cols-1 md:grid-cols-2 md:gap-x-8' : ''}`}>
        <div className={hasTranslation ? 'mb-4 md:mb-0' : ''}>
           <h4 className="text-lg font-semibold mb-2 text-slate-800">Abstract</h4>
            <p className="bg-slate-50 p-4 rounded-md border border-slate-200 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
              {article.abstract}
            </p>
        </div>

        {hasTranslation && (
          <div>
            <h4 className="text-lg font-semibold mb-2 text-sky-700">초록 (Korean)</h4>
            <p className="bg-slate-50 p-4 rounded-md border border-slate-200 whitespace-pre-wrap break-words leading-relaxed text-slate-700">
              {article.translatedAbstract}
            </p>
          </div>
        )}
      </div>
      
      {/* Actions Section */}
       <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="flex justify-between items-center">
          <a 
            href={article.pubmedUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Read on PubMed
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          
          <div className="flex items-center space-x-2">
            {!hasTranslation && (
               <button
                onClick={() => onTranslate(article.id)}
                disabled={article.isTranslating}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors duration-200"
              >
                 {article.isTranslating ? (
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

            {isSaved ? (
              <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-800 bg-green-100 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Saved
              </div>
            ) : (
              <button
                onClick={() => onSave(article)}
                disabled={article.isSaving}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {article.isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save to DB'
                )}
              </button>
            )}
          </div>
        </div>

        {article.translationError && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            <strong>Translation Error:</strong> {article.translationError}
          </div>
        )}
        {article.saveError && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            <strong>Save Error:</strong> {article.saveError}
          </div>
        )}
      </div>
    </article>
  );
};

export default ArticleCard;