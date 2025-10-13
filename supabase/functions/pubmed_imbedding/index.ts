// Deno type declaration
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST'
};
// Main handler for the edge function
async function handler(req) {
  // Handle CORS preflight requests
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
    // Parse the article data from the request body
    const article = await req.json();
    // Validate input
    if (!article.id || !article.title || !article.abstract) {
      return new Response(JSON.stringify({
        error: 'Article ID, title, and abstract are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // --- Step 1: Generate Embedding ---
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: "text-embedding-004"
    });
    const textToEmbed = `Title: ${article.title}\n\nAbstract: ${article.abstract}`;
    // Check text length (embedding models have input limits)
    if (textToEmbed.length > 20000) {
      return new Response(JSON.stringify({
        error: 'Text content too long for embedding (max 20,000 characters)'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Processing article: ${article.id}, text length: ${textToEmbed.length}`);
    // Use the correct API method for embeddings
    const embeddingResult = await model.embedContent({
      content: {
        parts: [
          {
            text: textToEmbed
          }
        ]
      }
    });
    const embeddingVector = embeddingResult.embedding.values;
    // Validate embedding
    if (!embeddingVector || embeddingVector.length === 0) {
      throw new Error('Failed to generate valid embedding vector');
    }
    console.log(`Generated embedding with dimension: ${embeddingVector.length}`);
    // --- Step 2: Save to Supabase ---
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    // Map frontend Article (camelCase) to database object (snake_case)
    const articleDbo = {
      id: article.id,
      title: article.title,
      abstract: article.abstract,
      authors: article.authors,
      pub_date: article.pubDate,
      pubmed_url: article.pubmedUrl,
      is_free: article.isFree || false,
      translated_title: article.translatedTitle || null,
      translated_abstract: article.translatedAbstract || null,
      pgvector: embeddingVector
    };
    const { data, error } = await supabaseAdmin.from('pubmed').insert([
      articleDbo
    ]);
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    console.log(`Successfully saved article: ${article.id}`);
    // Return a success response
    return new Response(JSON.stringify({
      message: 'Article saved successfully with embedding.',
      articleId: article.id,
      embeddingDimension: embeddingVector.length
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 201
    });
  } catch (error) {
    console.error('Error in pubmed_embedding function:', error);
    // Handle specific database errors
    if (error.code === '23505') {
      return new Response(JSON.stringify({
        error: 'This article has already been saved.',
        code: 'DUPLICATE_ENTRY'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 409
      });
    }
    // Handle NOT NULL constraint violations
    if (error.code === '23502') {
      return new Response(JSON.stringify({
        error: 'Required field is missing.',
        code: 'MISSING_FIELD',
        details: error.message
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // Handle Google API errors
    if (error.message?.includes('API') || error.message?.includes('quota')) {
      return new Response(JSON.stringify({
        error: 'Embedding service temporarily unavailable.',
        code: 'EMBEDDING_SERVICE_ERROR'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 503
      });
    }
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return new Response(JSON.stringify({
      error: 'Failed to save article.',
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
// Start the Deno server
Deno.serve(handler);
