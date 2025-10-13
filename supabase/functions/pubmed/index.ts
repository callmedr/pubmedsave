// Fix: Add Deno type declaration to resolve TypeScript errors.
import { GoogleGenAI, Type } from 'npm:@google/genai';
// Define CORS headers to allow requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST'
};
// The main handler function for the edge function
async function handler(req) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Extract title and abstract from the request body
    const { title, abstract } = await req.json();
    // Validate input
    if (!title || !abstract) {
      return new Response(JSON.stringify({
        error: 'Title and abstract are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Retrieve the Gemini API key from environment variables
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set!');
    }
    // Initialize the GoogleGenAI client
    const ai = new GoogleGenAI({
      apiKey
    });
    const model = 'gemini-2.5-flash';
    // Advanced prompt with a 4-step Chain-of-Thought including Self-Correction.
    const prompt = `
You are an expert team of medical translators and editors. Your task is to translate an English academic paper's title and abstract into flawless, professional Korean.

Follow this rigorous 4-step process:

**Step 1: Identify Key Terminology.**
The junior translator first analyzes the English text to list key medical/scientific terms and their standard Korean equivalents.

**Step 2: Create a Literal Draft.**
The junior translator creates a direct, literal translation focusing on accurately conveying the core meaning.

**Step 3: Refine into Professional Korean.**
A senior translator refines the literal draft into a version that uses formal Korean academic style (논문체), has a natural flow, and preserves the original nuance.

**Step 4: Conduct a Final Critical Review and Polish.**
A final editor, acting as a quality assurance specialist, critically reviews the translation from Step 3. The editor identifies any remaining awkward phrasing, subtle inaccuracies, or areas for improvement in academic tone, and then produces the final, polished version.

Provide ONLY the final, polished translation from Step 4 in the specified JSON format. **Crucially, preserve the paragraph structure of the original abstract; if the original abstract has multiple paragraphs, the translated abstract must also have multiple paragraphs with appropriate line breaks (\\n).**

---
**[Example]**

**[Input]**
**English Title:** "The Role of Gut Microbiota in Immune System Development"
**English Abstract:** "The human gut is colonized by a vast community of microorganisms, collectively known as the gut microbiota. Recent studies have highlighted the profound impact of these microbes on the development and function of the host immune system. This review discusses the key mechanisms through which the gut microbiota shapes both innate and adaptive immunity, from early life to adulthood.

We also explore how dysbiosis, an imbalance in the microbiota, is linked to various immune-related disorders, including allergies, autoimmune diseases, and inflammatory bowel disease."

**[Your Thought Process]**
*   **Step 1: Key Terms**
    *   Gut microbiota: 장내 미생물총
    *   Immune system: 면역 체계
    *   Host: 숙주
    *   Innate immunity: 선천성 면역
    *   Adaptive immunity: 적응성 면역
    *   Dysbiosis: 디스바이오시스 (장내 미생물 불균형)
    *   Immune-related disorders: 면역 관련 질환
    *   Inflammatory bowel disease: 염증성 장질환
*   **Step 2: Literal Draft**
    *   Title: 면역 체계 발달에서 장내 미생물총의 역할
    *   Abstract: 인간의 장은 거대한 미생물 군집에 의해 군집화되어 있으며, 집합적으로 장내 미생물총으로 알려져 있다. 최근 연구들은 이 미생물들이 숙주 면역 체계의 발달과 기능에 미치는 깊은 영향을 강조했다. 이 리뷰는 장내 미생물총이 초기부터 성인기까지 선천성 및 적응성 면역 모두를 형성하는 핵심 메커니즘을 논의한다.\\n\\n우리는 또한 미생물총의 불균형인 디스바이오시스가 알레르기, 자가면역질환, 염증성 장질환을 포함한 다양한 면역 관련 질환과 어떻게 연결되는지 탐구한다.
*   **Step 3: Refined Translation**
    *   Title: 면역 체계 발달에 있어 장내 미생물총의 역할
    *   Abstract: 인간의 장에는 장내 미생물총(gut microbiota)으로 총칭되는 방대한 미생물 군집이 서식하고 있다. 최근 연구들은 이러한 미생물이 숙주의 면역 체계 발달과 기능에 미치는 지대한 영향을 강조해왔다. 본 총설에서는 장내 미생물총이 초기 생애부터 성인기까지 선천성 및 적응성 면역을 형성하는 핵심 기전에 대해 논의한다.\\n\\n또한, 미생물총의 불균형 상태인 디스바이오시스(dysbiosis)가 알레르기, 자가면역질환, 염증성 장질환 등 다양한 면역 관련 질환과 어떻게 연관되는지 탐구한다.
*   **Step 4: Critical Review & Final Polish**
    *   **Critique:** The verb '서식하고 있다' is adequate but '존재한다' is more concise for an academic paper. '지대한 영향을 강조해왔다' can be rephrased for a stronger, more academic tone. '논의한다' and '탐구한다' are good, but '고찰한다' can be a more suitable alternative for a review paper.
    *   **Final Polished Version:**
        *   **Title:** 면역계 발달における 장내 미생물총의 역할 (Using '면역계' is a more standard term than '면역 체계' in many Korean contexts).
        *   **Abstract:** 인간의 장에는 장내 미생물총(gut microbiota)으로 총칭되는 방대한 미생물 군집이 존재한다. 최근 연구를 통해 이러한 미생물이 숙주 면역계의 발달과 기능에 핵심적인 역할을 수행한다는 점이 부각되었다. 본 총설은 초기 생애부터 성인기까지 장내 미생물총이 선천성 및 적응성 면역을 조절하는 핵심 기전을 고찰한다.\\n\\n더불어, 장내 미생물 불균형 상태인 디스바이오시스(dysbiosis)가 알레르기, 자가면역질환 및 염증성 장질환을 포함한 다양한 면역 관련 질환과 연관되는 기전을 탐구한다.

**[Final JSON Output for the Example]**
{
  "translatedTitle": "면역계 발달에서 장내 미생물총의 역할",
  "translatedAbstract": "인간의 장에는 장내 미생물총(gut microbiota)으로 총칭되는 방대한 미생물 군집이 존재한다. 최근 연구를 통해 이러한 미생물이 숙주 면역계의 발달과 기능에 핵심적인 역할을 수행한다는 점이 부각되었다. 본 총설은 초기 생애부터 성인기까지 장내 미생물총이 선천성 및 적응성 면역을 조절하는 핵심 기전을 고찰한다.\\n\\n더불어, 장내 미생물 불균형 상태인 디스바이오시스(dysbiosis)가 알레르기, 자가면역질환 및 염증성 장질환을 포함한 다양한 면역 관련 질환과 연관되는 기전을 탐구한다."
}
---

Now, please apply this rigorous 4-step process to the following content.

**[Actual Input]**

**English Title:** "${title}"
**English Abstract:** "${abstract}"

Provide ONLY the final JSON output containing the polished translation from your Step 4. Do not include your thought process in the final output.
`;
    // Call the Gemini API to generate the translation
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedTitle: {
              type: Type.STRING
            },
            translatedAbstract: {
              type: Type.STRING
            }
          },
          required: [
            "translatedTitle",
            "translatedAbstract"
          ]
        }
      }
    });
    const translatedContent = JSON.parse(response.text);
    // Return the successful translation
    return new Response(JSON.stringify(translatedContent), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    // Log the error and return a generic error message
    console.error('Error in translation function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return new Response(JSON.stringify({
      error: 'Failed to translate content.',
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
// Start the Deno server and listen for requests
Deno.serve(handler);
