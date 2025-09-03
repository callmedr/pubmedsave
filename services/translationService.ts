const SUPABASE_FUNCTION_URL = 'https://wdamqufoiswvmflszcbz.supabase.co/functions/v1/pubmed';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkYW1xdWZvaXN3dm1mbHN6Y2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5OTkyNzcsImV4cCI6MjA3MTU3NTI3N30.Ju9lTfaxFlJvJe3FnPzOSYulI1SpRBFPtznADQeqb1k';

interface TranslationResponse {
  translatedTitle: string;
  translatedAbstract: string;
}

export const translateArticle = async (title: string, abstract: string): Promise<TranslationResponse> => {
  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ title, abstract }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
    throw new Error(errorData.details || errorData.error || 'Failed to fetch translation.');
  }

  return response.json();
};
