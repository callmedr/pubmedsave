import { supabase } from '../supabase/client';
import type { Article } from '../types';

// This type represents the structure of the 'pubmed' table in the database.
// It uses snake_case to match PostgreSQL conventions.
type ArticleDbo = {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  pub_date: string;
  pubmed_url: string;
  is_free: boolean;
  translated_title?: string | null;
  translated_abstract?: string | null;
};

// Maps the frontend Article object (camelCase) to the database object (snake_case).
const toDbo = (article: Article): ArticleDbo => ({
  id: article.id,
  title: article.title,
  abstract: article.abstract,
  authors: article.authors,
  pub_date: article.pubDate,
  pubmed_url: article.pubmedUrl,
  is_free: article.isFree || false,
  translated_title: article.translatedTitle || null,
  translated_abstract: article.translatedAbstract || null,
});

/**
 * Saves a single article to the 'pubmed' table in Supabase.
 * @param article The article object from the frontend.
 * @throws An error if the insertion fails, e.g., due to a duplicate ID.
 */
export const saveArticle = async (article: Article): Promise<void> => {
  const { error } = await supabase.from('pubmed').insert([toDbo(article)]);

  if (error) {
    // Gracefully handle the common error of trying to save a duplicate article.
    if (error.code === '23505') { // PostgreSQL unique_violation code
      throw new Error('This article has already been saved.');
    }
    // For other errors, throw a generic message with the actual error.
    console.error('Supabase insert error:', error);
    throw new Error(`Database error: ${error.message}`);
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
