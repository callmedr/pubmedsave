// Deno type declaration
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
// NOTE: To enable vector similarity search, you need to create a function in your Supabase SQL editor.
// Go to "Database" -> "Functions" -> "Create a new function" and paste the following SQL code:
/*
CREATE OR REPLACE FUNCTION match_articles (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  abstract TEXT,
  authors TEXT,
  pub_date TEXT,
  pubmed_url TEXT,
  is_free BOOLEAN,
  translated_title TEXT,
  translated_abstract TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.abstract,
    p.authors,
    p.pub_date,
    p.pubmed_url,
    p.is_free,
    p.translated_title,
    p.translated_abstract,
    1 - (p.pgvector <=> query_embedding) as similarity
  FROM
    public.pubmed as p
  WHERE 1 - (p.pgvector <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;
*/ // Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST'
};
// Maps the database object (snake_case) to the frontend Article object (camelCase).
const fromDbo = (dbo)=>({
    id: dbo.id,
    title: dbo.title,
    abstract: dbo.abstract,
    authors: dbo.authors,
    pubDate: dbo.pub_date,
    pubmedUrl: dbo.pubmed_url,
    isFree: dbo.is_free,
    translatedTitle: dbo.translated_title || undefined,
    translatedAbstract: dbo.translated_abstract || undefined
  });
// Main handler for the edge function
async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get environment variables
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!geminiApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables.');
    }
    const { question } = await req.json();
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'Valid question is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Limit question length
    if (question.length > 1000) {
      return new Response(JSON.stringify({
        error: 'Question is too long (max 1000 characters)'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Processing RAG question: "${question.substring(0, 100)}..."`);
    // Initialize clients
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    // --- Step 1: Generate Embedding for the Question ---
    const embeddingModel = genAI.getGenerativeModel({
      model: "text-embedding-004"
    });
    const embeddingResult = await embeddingModel.embedContent(question);
    const queryEmbedding = embeddingResult.embedding.values;
    console.log(`Generated query embedding with dimension: ${queryEmbedding.length}`);
    // --- Step 2: Find Relevant Articles (Retrieval) ---
    const { data: articles, error: rpcError } = await supabaseAdmin.rpc('match_articles', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5 // Increased to 5 for better context
    });
    if (rpcError) {
      console.error('Supabase RPC error:', rpcError);
      // Handle specific RPC errors
      if (rpcError.code === '42883') {
        throw new Error('Database function "match_articles" not found. Please create the function first.');
      }
      throw new Error(`Database error: ${rpcError.message}`);
    }
    console.log(`Found ${articles?.length || 0} matching articles`);
    if (!articles || articles.length === 0) {
      return new Response(JSON.stringify({
        answer: "I couldn't find any relevant information in your saved articles to answer that question. Try rephrasing your question or adding more articles to your database.",
        sources: [],
        searchInfo: {
          articlesFound: 0,
          threshold: 0.7
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // --- Step 3: Construct Prompt for Gemini (Augmentation & Generation) ---
    const context = articles.map((article, index)=>`[Article ${index + 1}] (ID: ${article.id}, Similarity: ${article.similarity?.toFixed(3) || 'N/A'})
Title: ${article.title}
Abstract: ${article.abstract}
Authors: ${article.authors || 'Not specified'}
Publication Date: ${article.pub_date || 'Not specified'}`).join('\n\n---\n\n');
    const prompt = `You are an expert medical researcher assistant. Answer the user's question based ONLY on the provided scientific article abstracts.

**STRICT GUIDELINES:**
1. Base your answer EXCLUSIVELY on the information in the provided abstracts
2. Do NOT use external knowledge or make assumptions beyond what's stated
3. If the abstracts don't contain sufficient information, state: "Based on the provided articles, I cannot fully answer this question."
4. Cite specific articles when referencing information (e.g., "According to Article 1...")
5. Be precise and objective in your response
6. If there are conflicting findings between articles, mention this explicitly

**CONTEXT FROM RELEVANT ARTICLES:**
${context}

**USER QUESTION:**
${question}

**YOUR EVIDENCE-BASED ANSWER:**`;
    console.log(`Generating answer with context from ${articles.length} articles`);
    // --- Step 4: Generate the Answer ---
    const generativeModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800
      }
    });
    const result = await generativeModel.generateContent(prompt);
    const answer = result.response.text();
    console.log(`Generated answer length: ${answer.length} characters`);
    // --- Step 5: Return Response ---
    const sources = articles.map(fromDbo);
    return new Response(JSON.stringify({
      answer,
      sources,
      searchInfo: {
        articlesFound: articles.length,
        threshold: 0.7,
        maxSimilarity: articles[0]?.similarity?.toFixed(3) || 'N/A'
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in pubmed_rag_qa function:', error);
    // Handle specific Google API errors
    if (error.message?.includes('API') || error.message?.includes('quota')) {
      return new Response(JSON.stringify({
        error: 'AI service temporarily unavailable. Please try again later.',
        code: 'AI_SERVICE_ERROR'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 503
      });
    }
    // Handle embedding errors
    if (error.message?.includes('embedding')) {
      return new Response(JSON.stringify({
        error: 'Failed to process your question. Please try rephrasing.',
        code: 'EMBEDDING_ERROR'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return new Response(JSON.stringify({
      error: 'Failed to process your question.',
      code: 'INTERNAL_ERROR',
      details: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}
Deno.serve(handler);
