// Deno type declaration
import { createClient } from 'npm:@supabase/supabase-js@2';
// Define CORS headers
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
    // Detect question language ONCE at the beginning
    const isKorean = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(question);
    console.log(`Question language: ${isKorean ? 'Korean' : 'English'}`);
    // Initialize Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    // --- Step 1: Generate Embedding for the Question using REST API ---
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`;
    const embeddingPayload = {
      content: {
        parts: [
          {
            text: question
          }
        ]
      }
    };
    console.log(`Generating query embedding for question length: ${question.length}`);
    const embeddingResponse = await fetch(embeddingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(embeddingPayload)
    });
    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('Embedding API Error:', embeddingResponse.status, errorText);
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding.values;
    console.log(`Generated query embedding with dimension: ${queryEmbedding.length}`);
    // --- Step 2: Find Relevant Articles (Retrieval) ---
    const { data: articles, error: rpcError } = await supabaseAdmin.rpc('match_articles', {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: 7
    });
    if (rpcError) {
      console.error('Supabase RPC error:', rpcError);
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
          threshold: 0.4,
          relevantArticles: 0
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // --- Step 3a: Relevance Filtering (Pre-filtering step) ---
    const relevanceCheckUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    const articlesListForRelevance = articles.map((article, index)=>`Article ${index + 1}: "${article.title}"\nAbstract: ${article.abstract.substring(0, 300)}...`).join('\n\n---\n\n');
    const relevancePrompt = isKorean ? `당신은 의학 논문 관련성 평가자입니다.

사용자의 질문: "${question}"

아래의 ${articles.length}개 논문 제목과 초록을 읽고, 각 논문이 사용자의 질문과 얼마나 관련이 있는지 평가하세요.

**평가 기준:**
- 매우 관련있음 (9-10): 질문에 직접적으로 답변할 수 있는 핵심 내용
- 관련있음 (7-8): 질문과 관련이 있고 유용한 정보 제공
- 보통 관련 (5-6): 질문 주제와 관련이 있지만 간접적
- 약간 관련 (3-4): 관련 주제이지만 질문 답변에는 크게 도움 안 됨
- 관련 없음 (1-2): 거의 또는 전혀 관련이 없음

**중요: 너무 엄격하게 평가하지 마세요. 간접적으로라도 도움이 되면 5-6점 이상을 주세요.**

**JSON 형식으로만 응답하세요:**
\`\`\`json
{
  "relevanceScores": [
    {"articleNumber": 1, "relevanceScore": 9, "reason": "설명"},
    {"articleNumber": 2, "relevanceScore": 3, "reason": "설명"}
  ]
}
\`\`\`

**논문들:**
${articlesListForRelevance}` : `You are a medical paper relevance evaluator.

User's question: "${question}"

Read the titles and abstracts of the ${articles.length} articles below and evaluate how relevant each is to the user's question.

**Evaluation Criteria:**
- Highly Relevant (9-10): Directly answers the question with core content
- Relevant (7-8): Related to the question and provides useful information
- Moderately Relevant (5-6): Related topic but indirect
- Somewhat Relevant (3-4): Related topic but not very helpful for answering
- Not Relevant (1-2): Little or no relevance

**Important: Don't be too strict. If a paper is indirectly helpful, give it 5-6 points or higher.**

**Respond ONLY in JSON format:**
\`\`\`json
{
  "relevanceScores": [
    {"articleNumber": 1, "relevanceScore": 9, "reason": "explanation"},
    {"articleNumber": 2, "relevanceScore": 3, "reason": "explanation"}
  ]
}
\`\`\`

**Articles:**
${articlesListForRelevance}`;
    console.log('Evaluating article relevance...');
    let relevanceScores = [];
    try {
      const relevanceResponse = await fetch(relevanceCheckUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: relevancePrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
          }
        })
      });
      if (relevanceResponse.ok) {
        const relevanceData = await relevanceResponse.json();
        const relevanceText = relevanceData.candidates[0].content.parts[0].text;
        console.log('Raw relevance response:', relevanceText.substring(0, 500));
        // Parse JSON from response
        const jsonMatch = relevanceText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          relevanceScores = parsed.relevanceScores || [];
          console.log(`✅ Relevance evaluation completed:`, JSON.stringify(relevanceScores, null, 2));
        } else {
          console.warn('❌ No JSON found in relevance response');
        }
      } else {
        console.error('❌ Relevance response not OK:', relevanceResponse.status);
      }
    } catch (error) {
      console.error('❌ Relevance check failed:', error.message);
    }
    // --- Step 3b: Filter articles by relevance ---
    let filteredArticles = articles;
    let excludedCount = 0;
    let additionalArticles = [];
    if (relevanceScores.length > 0) {
      const scoreMap = new Map(relevanceScores.map((s)=>[
          s.articleNumber,
          s
        ]));
      // 디버깅: 각 논문의 점수 출력
      console.log('📊 Article scores:');
      articles.forEach((article, index)=>{
        const score = scoreMap.get(index + 1);
        console.log(`  Article ${index + 1}: ${score ? score.relevanceScore : 'N/A'}/10 - ${article.title.substring(0, 50)}...`);
      });
      filteredArticles = articles.filter((_, index)=>{
        const score = scoreMap.get(index + 1);
        const isRelevant = score && score.relevanceScore >= 5; // 6 → 5로 낮춤
        if (!isRelevant && score) {
          console.log(`  ❌ EXCLUDED Article ${index + 1} (score: ${score.relevanceScore}): ${articles[index].title.substring(0, 50)}...`);
        }
        return isRelevant;
      });
      excludedCount = articles.length - filteredArticles.length;
      console.log(`🔍 Filtered from ${articles.length} to ${filteredArticles.length} relevant articles (${excludedCount} excluded)`);
    } else {
      console.log('⚠️ No relevance scores available, using all articles');
    }
    // If articles were excluded, retrieve additional articles to compensate
    if (excludedCount > 0) {
      console.log(`🔄 Retrieving ${excludedCount} additional articles to compensate...`);
      try {
        const { data: moreArticles, error: additionalError } = await supabaseAdmin.rpc('match_articles', {
          query_embedding: queryEmbedding,
          match_threshold: 0.35,
          match_count: 15 + excludedCount // 더 많이 가져오기
        });
        if (additionalError) {
          console.error('❌ Additional search error:', additionalError);
        } else if (moreArticles) {
          console.log(`  📥 Retrieved ${moreArticles.length} candidate articles`);
          const existingIds = new Set(filteredArticles.map((a)=>a.id));
          const existingOriginalIds = new Set(articles.map((a)=>a.id));
          additionalArticles = moreArticles.filter((a)=>!existingIds.has(a.id) && !existingOriginalIds.has(a.id)) // 원본 7개도 제외
          .slice(0, excludedCount);
          console.log(`  ✅ Added ${additionalArticles.length} new articles:`);
          additionalArticles.forEach((article, idx)=>{
            console.log(`    ${idx + 1}. ${article.title.substring(0, 50)}... (similarity: ${article.similarity?.toFixed(3)})`);
          });
        }
      } catch (error) {
        console.error('❌ Failed to retrieve additional articles:', error.message);
      }
    } else {
      console.log('✅ No articles excluded, no additional search needed');
    }
    // Combine filtered + additional articles
    let finalArticles = [
      ...filteredArticles,
      ...additionalArticles
    ];
    // If still not enough articles, use what we have
    if (finalArticles.length === 0) {
      finalArticles = articles.slice(0, 3);
      console.log('No highly relevant articles found, using top 3');
    }
    console.log(`Final article set: ${finalArticles.length} articles (${filteredArticles.length} highly relevant + ${additionalArticles.length} additional)`);
    // --- Step 3c: Construct Prompt for Gemini (Augmentation & Generation) ---
    const context = finalArticles.map((article, index)=>{
      const originalIndex = articles.findIndex((a)=>a.id === article.id);
      const relevance = relevanceScores.find((s)=>s.articleNumber === originalIndex + 1);
      const isAdditional = additionalArticles.some((a)=>a.id === article.id);
      return `[Article ${index + 1}] ID: ${article.id}, Title: "${article.title}"
Authors: ${article.authors || 'Not specified'}
Publication Date: ${article.pub_date || 'Not specified'}
Similarity Score: ${article.similarity?.toFixed(3) || 'N/A'}
${relevance ? `Relevance Score: ${relevance.relevanceScore}/10` : 'Relevance Score: N/A (supplementary)'}
${isAdditional ? '(Supplementary article)' : ''}

Abstract excerpt:
${article.abstract}

---`;
    }).join('\n\n');
    const finalPrompt = isKorean ? `당신은 의학 연구 전문가이자 비판적 평가자입니다. 다음 지침을 반드시 따르세요.

**핵심 원칙:**
1. 제공된 초록의 정보에만 기반하여 답변하세요
2. 외부 지식을 사용하거나 기술되지 않은 가정을 하지 마세요
3. 각 주장마다 어떤 논문의 어떤 내용을 근거로 하는지 명확히 명시하세요

**관련성 평가:**
- 각 논문이 사용자의 질문과 얼마나 관련있는지 먼저 평가하세요
- 관련성이 낮은 논문은 명확하게 "이 논문은 이 질문과 직접적인 관련이 없습니다"라고 표시하세요
- 관련 있는 논문들만을 중심으로 답변을 구성하세요

**답변 구성:**
1. **답변 가능성 평가**: 제공된 논문들로 이 질문에 완전히 답할 수 있는지, 부분적으로만 답할 수 있는지 명시
2. **주요 내용**: 관련 논문들의 구체적인 내용을 포함 (수치, 연구 결과, 방법론 등)
3. **논문별 근거**: 각 주장마다 "논문 X (저자명, 연도)"로 정확히 명시
4. **한계 표시**: 제공된 논문들로 답할 수 없는 부분이 있으면 명확하게 표시
5. **논문 간 상충**: 다른 논문들 간의 상충하는 내용이 있으면 반드시 표시

**금지사항:**
- ❌ 관련 없는 논문을 억지로 포함시키기
- ❌ 추측이나 일반적인 의학 지식으로 채우기
- ❌ 제공된 논문에 없는 수치나 결과 언급하기
- ❌ 불명확한 "대부분의 연구에서" 같은 모호한 표현

**필요한 경우의 응답:**
- 관련 논문이 충분하지 않으면: "제공된 논문만으로는 이 질문에 충분히 답할 수 없습니다. 다음 정보가 필요합니다: [부족한 부분]"
- 논문들이 모순되면: "논문 X와 논문 Y는 상충하는 결과를 보고합니다: [차이점]"

**제공된 논문들:**
${context}

**사용자 질문:**
${question}

**상세한 답변 (관련성 평가 → 답변 가능성 확인 → 근거 중심 작성):**` : `You are a medical research expert and critical evaluator. Follow these guidelines strictly.

**CORE PRINCIPLES:**
1. Answer ONLY based on information in the provided abstracts
2. Do NOT use external knowledge or make unsupported assumptions
3. ALWAYS cite which article and what specific content supports each claim

**RELEVANCE ASSESSMENT:**
- FIRST, evaluate how relevant each article is to the user's question
- CLEARLY mark articles that are NOT directly related: "This article is not directly relevant to this question"
- Build your answer ONLY around the relevant articles
- Be honest about relevance scores

**ANSWER STRUCTURE:**
1. **Answerability Assessment**: State clearly whether the provided articles can fully answer this question, partially answer it, or cannot answer it
2. **Main Content**: Include specific data, numbers, research findings, and methodologies from relevant articles
3. **Evidence Citation**: ALWAYS cite "Article X (Author, Year)" for each claim
4. **Limitations**: EXPLICITLY state what cannot be answered with these articles
5. **Conflicting Information**: If different articles have conflicting findings, MUST mention this

**FORBIDDEN:**
- ❌ Don't force irrelevant articles into your answer
- ❌ Don't fill gaps with general medical knowledge
- ❌ Don't mention numbers or results not in the provided papers
- ❌ Don't use vague phrases like "most studies show"

**RESPONSE TEMPLATES:**
- When insufficient data: "The provided articles cannot adequately answer this question. The following information is needed: [gaps]"
- When conflicting: "Article X reports [finding], while Article Y reports [different finding]. The difference may be due to [reason if stated]"
- When uncertain: "Based on these articles, I cannot determine [specific aspect]"

**PROVIDED ARTICLES:**
${context}

**USER QUESTION:**
${question}

**DETAILED ANSWER (Assess relevance → Check answerability → Write evidence-based response):**`;
    console.log(`Generating answer with context from ${finalArticles.length} articles`);
    // --- Step 4: Generate the Answer using REST API with retry logic ---
    const generationUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    const generationPayload = {
      contents: [
        {
          parts: [
            {
              text: finalPrompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000
      }
    };
    let answer;
    const maxRetries = 3;
    for(let attempt = 1; attempt <= maxRetries; attempt++){
      try {
        console.log(`Attempt ${attempt} to generate answer`);
        const generationResponse = await fetch(generationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(generationPayload)
        });
        if (!generationResponse.ok) {
          const errorText = await generationResponse.text();
          console.error(`Generation attempt ${attempt} failed:`, generationResponse.status, errorText);
          if (generationResponse.status === 503) {
            if (attempt === maxRetries) {
              answer = `I've found ${finalArticles.length} relevant article(s) for your question, but the AI service is currently overloaded. Please review the sources below for information about: "${question}"`;
              break;
            }
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise((resolve)=>setTimeout(resolve, waitTime));
            continue;
          } else if (generationResponse.status === 429) {
            answer = `I've found ${finalArticles.length} relevant article(s) for your question, but I've exceeded my API quota. Please review the sources below for information about: "${question}"`;
            break;
          } else {
            throw new Error(`Generation API failed: ${generationResponse.status}`);
          }
        }
        const generationData = await generationResponse.json();
        if (!generationData.candidates || !generationData.candidates[0] || !generationData.candidates[0].content) {
          throw new Error('Invalid generation response format');
        }
        answer = generationData.candidates[0].content.parts[0].text;
        console.log(`Successfully generated answer on attempt ${attempt}`);
        break;
      } catch (error) {
        console.error(`Attempt ${attempt} error:`, error.message);
        if (attempt === maxRetries) {
          answer = `I found ${finalArticles.length} relevant article(s) for your question. Unfortunately, I cannot generate a summary at this moment due to service issues. Please review the sources below.`;
        }
      }
    }
    // --- Step 5: Return Response ---
    // Return the final articles used for generating the answer, not the original ones
    const sources = finalArticles.map(fromDbo);
    return new Response(JSON.stringify({
      answer,
      sources,
      searchInfo: {
        articlesFound: articles.length,
        highlyRelevantArticles: filteredArticles.length,
        supplementaryArticles: additionalArticles.length,
        totalUsedArticles: finalArticles.length,
        threshold: 0.4,
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
