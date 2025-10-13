import { supabase } from '../supabase/client';
import type { Article } from '../types';

// This type represents the structure of the 'pubmed' table in the database.
// It uses snake_case to match PostgreSQL conventions.
type ArticleDbo = {
  id: string;
  created_at: string;
  title: string;
  abstract: string;
  authors: string;
  pub_date: string;
  pubmed_url: string;
  is_free: boolean;
  translated_title?: string | null;
  translated_abstract?: string | null;
};

// Maps the database object (snake_case) to the frontend Article object (camelCase).
const fromDbo = (dbo: ArticleDbo): Article => ({
  id: dbo.id,
  title: dbo.title,
  abstract: dbo.abstract,
  authors: dbo.authors,
  pubDate: dbo.pub_date,
  pubmedUrl: dbo.pubmed_url,
  isFree: dbo.is_free,
  translatedTitle: dbo.translated_title || undefined,
  translatedAbstract: dbo.translated_abstract || undefined,
});

/**
 * Saves a single article by invoking the 'pubmed_imbedding' edge function,
 * which handles embedding generation and database insertion.
 * @param article The article object from the frontend.
 * @throws An error if the function invocation or saving fails.
 */
export const saveArticle = async (article: Article): Promise<void> => {
  const { error } = await supabase.functions.invoke('pubmed_imbedding', {
    body: article,
  });

  if (error) {
    console.error('Supabase function invoke error:', error);

    const functionError = error.context?.json?.error;
    const functionDetails = error.context?.json?.details;

    // Specific user-facing error for duplicates
    if (functionError?.includes('This article has already been saved.')) {
        throw new Error('This article has already been saved.');
    }

    // Generic but more detailed error for other cases
    let errorMessage = functionError || 'An unknown error occurred while saving the article.';
    if (functionDetails) {
        errorMessage += ` (Details: ${functionDetails})`;
    }

    throw new Error(errorMessage);
  }
};

/**
 * Fetches the IDs of all articles currently saved in the 'pubmed' table.
 * @returns A Set of strings, where each string is a saved article's PubMed ID.
 */
export const getSavedArticleIds = async (): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('pubmed')
    .select('id');

  if (error) {
    console.error('Error fetching saved article IDs:', error);
    // Return an empty set on error to prevent the app from crashing.
    return new Set<string>();
  }

  return new Set(data.map(item => item.id));
};

/**
 * Fetches all saved articles from the 'pubmed' table.
 * @returns An array of Article objects, sorted by most recently saved.
 */
export const getSavedArticles = async (): Promise<Article[]> => {
    const { data, error } = await supabase
      .from('pubmed')
      .select('*')
      .order('created_at', { ascending: false });
  
    if (error) {
      console.error('Error fetching saved articles:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  
    return (data as ArticleDbo[]).map(fromDbo);
  };

/**
 * Asks a question about saved articles by invoking the RAG pipeline.
 * @param question The user's question.
 * @returns An object containing the answer and the source articles.
 */
export const askQuestion = async (question: string): Promise<{ answer: string; sources: Article[] }> => {
    const { data, error } = await supabase.functions.invoke('pubmed_rag_qa', {
        body: { question },
    });

    if (error) {
        console.error('Supabase function invoke error (pubmed_rag_qa):', error);
        const functionError = error.context?.json?.error || 'Failed to get an answer from the server.';
        const functionDetails = error.context?.json?.details;
        
        let errorMessage = functionError;
        if(functionDetails) {
            errorMessage += ` (Details: ${functionDetails})`
        }
        
        throw new Error(errorMessage);
    }
    
    // The 'sources' from the edge function are already mapped to camelCase Article objects
    return data;
};
