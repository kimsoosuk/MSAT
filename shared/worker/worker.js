/**
 * MSAT English — Cloudflare Worker
 * ---------------------------------
 * Two-in-one endpoint:
 *   1. Grade the student's two short-writing answers (Q29, Q30), each 0–5.
 *   2. Using the full score picture (MC + graded writing + region activations),
 *      produce a personalized Korean thinking-profile report.
 *
 * The Worker asks Gemini for a single structured JSON response, then returns:
 *   {
 *     writingGrades: {
 *       "29": { score: 0..5, feedback: string },
 *       "30": { score: 0..5, feedback: string }
 *     },
 *     report: "<markdown>",
 *     model: "<model-used>"
 *   }
 *
 * Environment variables:
 *   - GEMINI_KEY : Gemini API key
 *
 * Models (with automatic fallback):
 *   Primary  : gemini-3-flash
 *   Fallback : gemini-2.5-flash
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MODEL_PRIMARY = "gemini-3-flash";
const MODEL_FALLBACK = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Custom error class
class GeminiError extends Error {
  constructor(message, { status = null, model = null, raw = null } = {}) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.model = model;
    this.raw = raw;
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
function buildPrompt(payload) {
  const {
    studentName,
    preliminaryMcScore,
    regions,
    regionMean,
    regionStdev,
    strongest,
    weakest,
    topWords,
    bottomWords,
    writingSubmissions,
  } = payload;

  const regionTable = regions
    .map(
      (r) =>
        `- ${r.kr} (${r.area}): 절대 ${r.absolute}% · 상대 z=${
          r.relativeZ >= 0 ? "+" : ""
        }${r.relativeZ}`
    )
    .join("\n");

  const topWordsStr = topWords
    .map((w) => `${w.word} [${w.region}] ${w.intensity}%`)
    .join(", ");

  const bottomWordsStr = bottomWords
    .map((w) => `${w.word} [${w.region}] ${w.intensity}%`)
    .join(", ");

  const w29 = writingSubmissions.find((w) => w.n === 29);
  const w30 = writingSubmissions.find((w) => w.n === 30);

  const w29Sim = (w29?.fields?.similarities || "").trim() || "(미작성)";
  const w29Diff = (w29?.fields?.differences || "").trim() || "(미작성)";
  const w30Ans = (w30?.fields?.answer || "").trim() || "(미작성)";

  return `당신은 한국 중학생의 영어 능력과 사고력을 평가하는 전문 교육 코치입니다.
다음 학생의 답안을 평가하고, 사고력 프로필 리포트를 작성하세요.

반드시 JSON 하나만 출력하세요. JSON 앞뒤에 설명, 마크다운 코드펜스(\`\`\`) 어떤 것도 넣지 마세요.

=============================================================
【 학생 정보 】
이름: ${studentName}

【 객관식 점수 (현재까지) 】
${preliminaryMcScore.correct} / ${preliminaryMcScore.total} 문항 정답
객관식 점수: ${preliminaryMcScore.mcPoints} / ${preliminaryMcScore.mcPointsMax} 점 (90점 배점)

【 뇌 다섯 영역 활성도 (객관식 기준) 】
${regionTable}
평균 ${regionMean}%  ·  표준편차 ${regionStdev}

강점 후보: ${strongest.join(", ")}
보완 후보: ${weakest.join(", ")}

【 상위 활성 사고력 단어 】 ${topWordsStr}
【 하위 활성 사고력 단어 】 ${bottomWordsStr}

=============================================================
【 서술형 Q29 】 (5점 만점)
문제: Compare a frog and a dog. Write down five similarities and five differences between them. Use complete sentences.

학생 답안 — Five Similarities:
${w29Sim}

학생 답안 — Five Differences:
${w29Diff}

=============================================================
【 서술형 Q30 】 (5점 만점)
문제: Have you ever heard the word "concept"? What do you think the word "concept" means? Write 3 to 5 sentences explaining your own understanding of this word. Give at least one example to support your explanation.

학생 답안:
${w30Ans}

=============================================================

【 채점 기준 — Q29 (5점 만점) 】
- 5점: 공통점·차이점 각 5개씩 모두 제시, 모두 완전한 영어 문장, 기준이 일관되고 관점이 명확함
- 4점: 공통점·차이점 각 5개씩 제시, 문장이 대부분 완전, 일부 비교 기준이 느슨함
- 3점: 공통점·차이점 합쳐 7~8개 정도, 문장 일부 미완성 또는 반복적 기준
- 2점: 4~6개 정도만 제시, 짧은 구/단어 위주, 비교 관점이 약함
- 1점: 1~3개만 작성, 문장이 매우 짧거나 의미 불분명
- 0점: 미작성 또는 영어가 아닌 답변

【 채점 기준 — Q30 (5점 만점) 】
- 5점: 'concept(개념)'에 대한 자기만의 명확한 정의 + 적절한 예시 1개 이상 + 3~5 영어 문장
- 4점: 정의는 있으나 다소 일반적, 예시 있음, 3문장 이상
- 3점: 정의가 모호하거나 예시가 약함, 문장은 충분
- 2점: 정의 또는 예시 중 하나만 있음, 짧음
- 1점: 단편적 문구, 정의와 예시 모두 약함
- 0점: 미작성 또는 영어가 아닌 답변

=============================================================

【 출력 스펙 】
아래 JSON 스키마에 정확히 맞춰 출력하세요.
report 필드는 한국어 마크다운 문자열입니다.

{
  "writingGrades": {
    "29": { "score": <0-5 정수>, "feedback": "<한국어 1~2문장 짧은 피드백>" },
    "30": { "score": <0-5 정수>, "feedback": "<한국어 1~2문장 짧은 피드백>" }
  },
  "report": "<아래 명시한 구조의 한국어 마크다운 리포트>"
}

【 report 작성 구조 — 반드시 이 순서와 헤더를 지킬 것 】

## 총평

> (한 문단의 인용문, "> "로 시작. 학생 프로필을 한 눈에 보여주는 인상적인 요약. 3-4문장)

(2~3문단으로 이 학생의 고유한 사고 스타일을 해석. 절대 점수(100점 만점 총점)와 상대 프로필(뇌 영역 간 편차)을 함께 고려. 서술형 답변에서 드러난 사고 흐름도 반영.)

## 강점 사고력

활성도가 가장 두드러진 뇌 영역/사고력 2개를 선정. 각각 아래 형식으로:

#### [강점] (사고력 이름) — (뇌 영역)

**이 사고력의 의미:** (2-3문장)

**실제 공부에서의 힘:** (이 사고력이 강하면 구체적으로 어떤 학습 상황에서 유리한지. 실제 과목과 장면으로)

**${studentName}의 경우:** (데이터·답안에서 관찰된 구체적 근거)

## 보완이 필요한 사고력

상대적으로 약하고 절대값도 부족한 영역 2개를 선정. 각각 아래 형식으로:

#### [약점] (사고력 이름) — (뇌 영역)

**이 사고력의 의미:** (간결하게)

**부족할 때의 어려움:** (학습에서 겪는 구체적 어려움)

**${studentName}의 경우:** (데이터·답안에서 관찰된 근거)

## 맞춤형 학습 솔루션

위 보완 영역을 극복할 수 있는 실천 가능한 솔루션 3개. 각각:

#### [솔루션] (짧고 구체적인 제목)

- **왜 필요한가:** (한 문장)
- **어떻게 실천하나:** (2-3문장, 구체적 활동과 빈도)
- **얼마나 걸리나:** (예: 하루 15분, 한 달 등)

## 마지막으로

${studentName} 학생에게 보내는 격려 메시지 (3-4문장). 진심 어린 톤으로.

---

【 중요 원칙 】
1. 출력은 **오직 JSON 하나**. 다른 텍스트 금지.
2. report 안에서는 마크다운 사용 (## ####, **굵게**, *기울임*, > 인용문, - 목록). [강점]/[약점]/[솔루션] 태그 반드시 포함.
3. 5개 영역의 편차가 작다면(표준편차 < 8) "프로필이 전반적으로 균형적"이라는 점을 총평에서 언급.
4. 점수대별 톤 조정:
   - 90점 이상: 성취 인정 + 더 높은 도전 권유
   - 75-89점: 강점 구체화 + 약점 보완
   - 60-74점: 가능성 강조 + 구체적 방법 제시
   - 40-59점: 기초 다지기 우선 + 격려
   - 40점 미만: 부담 덜어주되 꾸준함의 방향 제시
5. "~해보세요", "~를 권합니다" 같은 제안형. 훈계조 금지.
6. 이 학생의 이름을 자연스럽게 호명.
7. report는 약 800~1200자 한글 기준.`;
}

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------
async function callGemini(model, apiKey, prompt) {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      { role: "user", parts: [{ text: prompt }] },
    ],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 3500,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new GeminiError(
      `Gemini ${model} returned ${resp.status}: ${errText.slice(0, 300)}`,
      { status: resp.status, model }
    );
  }

  const data = await resp.json();

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    throw new GeminiError(`Gemini ${model} returned an empty response`, {
      model,
      raw: data,
    });
  }

  return text;
}

// ---------------------------------------------------------------------------
// JSON extractor — robust to stray preambles/code fences
// ---------------------------------------------------------------------------
function extractJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else if (firstBrace === 0 && lastBrace > 0) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function validateAndNormalize(parsed) {
  const grades = parsed?.writingGrades || {};
  return {
    writingGrades: {
      "29": {
        score: clampScore(grades["29"]?.score),
        feedback: String(grades["29"]?.feedback || "").slice(0, 500),
      },
      "30": {
        score: clampScore(grades["30"]?.score),
        feedback: String(grades["30"]?.feedback || "").slice(0, 500),
      },
    },
    report: String(parsed?.report || "").trim(),
  };
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET") {
      return json(
        {
          service: "MSAT English · Gemini Worker",
          models: { primary: MODEL_PRIMARY, fallback: MODEL_FALLBACK },
          status: "ok",
        },
        200
      );
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const apiKey = env.GEMINI_KEY;
    if (!apiKey) {
      return json({ error: "GEMINI_KEY is not configured on the Worker" }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!payload || !payload.studentName || !payload.regions || !payload.writingSubmissions) {
      return json({ error: "Missing required fields in payload" }, 400);
    }

    const prompt = buildPrompt(payload);

    // Try primary, then fallback
    let modelUsed = MODEL_PRIMARY;
    let rawText;
    let primaryError = null;

    try {
      rawText = await callGemini(MODEL_PRIMARY, apiKey, prompt);
    } catch (e) {
      primaryError = e;
      console.error(`Primary model failed: ${e.message}`);
      try {
        modelUsed = MODEL_FALLBACK;
        rawText = await callGemini(MODEL_FALLBACK, apiKey, prompt);
      } catch (e2) {
        console.error(`Fallback model also failed: ${e2.message}`);
        return json(
          {
            error: "Both Gemini models failed",
            primary: primaryError?.message || null,
            fallback: e2?.message || null,
          },
          502
        );
      }
    }

    let parsed;
    try {
      parsed = extractJson(rawText);
    } catch (e) {
      console.error("JSON parse failed:", e.message, "Raw preview:", rawText.slice(0, 500));
      return json(
        {
          error: "Gemini output was not valid JSON",
          detail: e.message,
          rawPreview: rawText.slice(0, 500),
        },
        502
      );
    }

    const normalized = validateAndNormalize(parsed);

    if (!normalized.report) {
      return json({ error: "Gemini produced empty report" }, 502);
    }

    return json(
      {
        writingGrades: normalized.writingGrades,
        report: normalized.report,
        model: modelUsed,
      },
      200
    );
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}
