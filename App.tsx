import React, { useState, useCallback, useEffect } from 'react';
import type { Article } from './types';
import { searchPubMed } from './services/pubmedService';
import type { SortOption } from './services/pubmedService';
import { translateArticle } from './services/translationService';
import { saveArticle, getSavedArticleIds, getSavedArticles, askQuestion } from './services/supabaseService';
import SearchBar from './components/SearchBar';
import ArticleCard from './components/ArticleCard';
import Loader from './components/Loader';
import ErrorMessage from './components/ErrorMessage';
import SortOptions from './components/SortOptions';
import QASearchBar from './components/QASearchBar';
import AnswerCard from './components/AnswerCard';

type View = 'search' | 'saved';

const App: React.FC = () => {
  // General State
  const [view, setView] = useState<View>('search');
  const [error, setError] = useState<string | null>(null);

  // Search View State
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  // Saved View State
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set());
  
  // Q&A State
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaSources, setQaSources] = useState<Article[]>([]);
  const [qaError, setQaError] = useState<string | null>(null);

  // Batch Save State
  const [isBatchSaving, setIsBatchSaving] = useState<boolean>(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState<{ saved: number; total: number }>({ saved: 0, total: 0 });
  const [batchSaveMessage, setBatchSaveMessage] = useState<string | null>(null);


  useEffect(() => {
    const fetchSavedIds = async () => {
      try {
        const ids = await getSavedArticleIds();
        setSavedArticleIds(ids);
      } catch (err) {
        console.error("Could not fetch saved articles:", err);
      }
    };
    fetchSavedIds();
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setArticles([]);
    setVisibleCount(20); // Reset for new search
    setBatchSaveMessage(null); // Clear batch save message on new search

    try {
      const results = await searchPubMed(query, sortBy);
      setArticles(results);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  const handleTranslate = useCallback(async (articleId: string) => {
    const isSearch = view === 'search';
    const targetList = isSearch ? articles : savedArticles;
    const setTargetList = isSearch ? setArticles : setSavedArticles;

    setTargetList(prev =>
      prev.map(a =>
        a.id === articleId ? { ...a, isTranslating: true, translationError: undefined } : a
      )
    );

    const articleToTranslate = targetList.find(a => a.id === articleId);
    if (!articleToTranslate) return;

    try {
      const { translatedTitle, translatedAbstract } = await translateArticle(
        articleToTranslate.title,
        articleToTranslate.abstract
      );

      setTargetList(prev =>
        prev.map(a =>
          a.id === articleId
            ? { ...a, translatedTitle, translatedAbstract, isTranslating: false }
            : a
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed.';
      setTargetList(prev =>
        prev.map(a =>
          a.id === articleId ? { ...a, isTranslating: false, translationError: errorMessage } : a
        )
      );
    }
  }, [articles, savedArticles, view]);

  const handleSave = useCallback(async (articleToSave: Article) => {
    setArticles(prev => prev.map(a => 
        a.id === articleToSave.id ? { ...a, isSaving: true, saveError: null } : a
    ));

    try {
        await saveArticle(articleToSave);
        setSavedArticleIds(prev => new Set(prev).add(articleToSave.id));
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save article.';
        setArticles(prev => prev.map(a => 
            a.id === articleToSave.id ? { ...a, saveError: errorMessage } : a
        ));
    } finally {
        setArticles(prev => prev.map(a => 
            a.id === articleToSave.id ? { ...a, isSaving: false } : a
        ));
    }
  }, []);

  const handleBatchSave = async () => {
    setIsBatchSaving(true);
    setBatchSaveMessage(null);

    const visibleArticles = articles.slice(0, visibleCount);
    const articlesToSave = visibleArticles.filter(a => !savedArticleIds.has(a.id));
    const skippedCount = visibleArticles.length - articlesToSave.length;

    if (articlesToSave.length === 0) {
      setBatchSaveMessage(`All ${visibleArticles.length} visible articles are already saved.`);
      setIsBatchSaving(false);
      return;
    }

    let savedCount = 0;
    let failedCount = 0;
    setBatchSaveProgress({ saved: 0, total: articlesToSave.length });

    for (const article of articlesToSave) {
      try {
        await saveArticle(article);
        savedCount++;
        setSavedArticleIds(prev => new Set(prev).add(article.id));
      } catch (err) {
        console.error(`Failed to save article ${article.id}:`, err);
        failedCount++;
      }
      setBatchSaveProgress({ saved: savedCount, total: articlesToSave.length });
    }

    let finalMessage = `${savedCount} article(s) saved successfully.`;
    if (skippedCount > 0) {
      finalMessage += ` ${skippedCount} were already saved.`;
    }
    if (failedCount > 0) {
      finalMessage += ` ${failedCount} failed to save.`;
    }
    setBatchSaveMessage(finalMessage);
    setIsBatchSaving(false);
  };

  const handleLoadMore = () => {
    setVisibleCount(prevCount => prevCount + 20);
  };

  const handleViewSaved = async () => {
    setView('saved');
    setIsLoadingSaved(true);
    setError(null);
    setQaAnswer(null); // Reset Q&A state when switching views
    setQaSources([]);
    setQaError(null);
    try {
        const saved = await getSavedArticles();
        setSavedArticles(saved);
    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('An unknown error occurred while fetching saved articles.');
        }
    } finally {
        setIsLoadingSaved(false);
    }
  }

  const handleAsk = useCallback(async (question: string) => {
    setIsAnswering(true);
    setQaError(null);
    setQaAnswer(null);
    setQaSources([]);
    
    try {
        const result = await askQuestion(question);
        setQaAnswer(result.answer);
        setQaSources(result.sources);
    } catch (err) {
        if (err instanceof Error) {
            setQaError(err.message);
        } else {
            setQaError('An unknown error occurred while getting the answer.');
        }
    } finally {
        setIsAnswering(false);
    }
  }, []);

  const handleTranslateSource = useCallback(async (articleId: string) => {
    setQaSources(prev =>
      prev.map(a =>
        a.id === articleId ? { ...a, isTranslating: true, translationError: undefined } : a
      )
    );

    const articleToTranslate = qaSources.find(a => a.id === articleId);
    if (!articleToTranslate) return;

    try {
      const { translatedTitle, translatedAbstract } = await translateArticle(
        articleToTranslate.title,
        articleToTranslate.abstract
      );

      setQaSources(prev =>
        prev.map(a =>
          a.id === articleId
            ? { ...a, translatedTitle, translatedAbstract, isTranslating: false }
            : a
        )
      );
      
      // Also update the main savedArticles list so the translation persists
      setSavedArticles(prev =>
        prev.map(a =>
          a.id === articleId
            ? { ...a, translatedTitle, translatedAbstract }
            : a
        )
      );

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed.';
      setQaSources(prev =>
        prev.map(a =>
          a.id === articleId ? { ...a, isTranslating: false, translationError: errorMessage } : a
        )
      );
    }
}, [qaSources]);
  
  const renderSearchContent = () => {
    if (isLoading) {
      return <Loader />;
    }
    if (error) {
      return <ErrorMessage message={error} />;
    }
    if (!hasSearched) {
      return (
         <div className="text-center p-12 bg-white rounded-lg shadow-lg border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-700">Welcome to PubMed Article Finder</h2>
            <p className="mt-2 text-slate-500">Enter a topic in the search bar above to find the latest articles.</p>
        </div>
      );
    }
    if (articles.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-lg shadow-lg border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-700">No Articles Found</h2>
                <p className="mt-2 text-slate-500">Your search did not match any articles. Please try different keywords.</p>
            </div>
        );
    }
    return (
      <>
        {articles.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200 mb-6 text-center">
            <button
              onClick={handleBatchSave}
              disabled={isBatchSaving}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
            >
              {isBatchSaving 
                ? `Saving... (${batchSaveProgress.saved}/${batchSaveProgress.total})`
                : 'Save All Visible Articles to DB'}
            </button>
            {isBatchSaving && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
                    <div 
                        className="bg-green-500 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${(batchSaveProgress.saved / batchSaveProgress.total) * 100}%` }}>
                    </div>
                </div>
            )}
            {batchSaveMessage && (
              <p className="mt-3 text-sm text-slate-600">{batchSaveMessage}</p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {articles.slice(0, visibleCount).map((article) => (
            <ArticleCard 
              key={article.id} 
              article={article} 
              onTranslate={handleTranslate}
              onSave={handleSave}
              isSaved={savedArticleIds.has(article.id)}
              isBatchSaving={isBatchSaving}
            />
          ))}
        </div>
        {visibleCount < articles.length && (
           <div className="text-center mt-8">
            <button
              onClick={handleLoadMore}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Load 20 more articles"
            >
              Load 20 More
            </button>
          </div>
        )}
      </>
    );
  }

  const renderSavedContent = () => {
    if (isLoadingSaved) {
        return <Loader />;
    }
    if (error) {
        return <ErrorMessage message={error} />;
    }
    if (savedArticles.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-lg shadow-lg border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-700">No Saved Articles</h2>
                <p className="mt-2 text-slate-500">You haven't saved any articles yet. Use the "Save to DB" button on a search result to be able to ask questions about them.</p>
            </div>
        );
    }
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-1">Ask a Question</h2>
                <p className="text-slate-500 mb-4">Get insights from your {savedArticles.length} saved articles.</p>
                <QASearchBar onAsk={handleAsk} isLoading={isAnswering} />
            </div>

            {isAnswering && <Loader />}
            {qaError && <ErrorMessage message={qaError} />}
            {qaAnswer && <AnswerCard answer={qaAnswer} sources={qaSources} onTranslate={handleTranslateSource} />}
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-slate-200">
        <div className="container mx-auto px-4 py-5">
           <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <svg className="w-10 h-10 text-blue-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <div>
                  <h1 className="text-3xl font-bold text-slate-800">
                    PubMed Article Finder
                  </h1>
                  <p className="text-slate-500 mt-1">
                    Search the latest medical and scientific literature.
                  </p>
                </div>
              </div>
               <div>
                {view === 'search' ? (
                  <button onClick={handleViewSaved} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-3.13L5 18V4z" />
                    </svg>
                    View Saved Articles
                  </button>
                ) : (
                   <button onClick={() => setView('search')} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Back to Search
                  </button>
                )}
              </div>
          </div>
        </div>
        {view === 'search' && (
            <div className="container mx-auto px-4 pt-2 pb-5">
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
              <SortOptions 
                  currentSort={sortBy}
                  onSortChange={setSortBy}
                  disabled={isLoading}
                />
            </div>
        )}
      </header>
      <main className="container mx-auto p-4">
        {view === 'search' && renderSearchContent()}
        {view === 'saved' && renderSavedContent()}
      </main>
      <footer className="text-center py-4 text-slate-400 text-sm">
        <p>Powered by React, Tailwind CSS, and the PubMed E-utilities API.</p>
      </footer>
    </div>
  );
};

export default App;