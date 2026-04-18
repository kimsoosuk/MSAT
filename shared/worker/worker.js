/**
 * MSAT · shared/worker/worker.js
 * -------------------------------------------------------------------
 * 하나의 Cloudflare Worker가 모든 과목/리포트 타입을 라우팅한다.
 *
 * 엔드포인트:
 *   GET  /                                      → 헬스체크
 *   POST /?type=subject&subject=english         → 영어 과목별 리포트 + 서술형 채점
 *   POST /?type=subject&subject=korean          → 국어 (미래)
 *   POST /?type=subject&subject=math            → 수학 (미래)
 *   POST /?type=brain                           → 3과목 통합 사고력 리포트 (미래)
 *
 * 프롬프트는 shared/worker/prompts/ 안에서 import.
 * Wrangler가 배포 시 자동으로 하나의 파일로 번들링함.
 *
 * 환경변수:
 *   GEMINI_KEY   — Gemini API 키
 *
 * 모델(자동 폴백):
 *   Primary  : gemini-3-flash
 *   Fallback : gemini-2.5-flash
 * -------------------------------------------------------------------
 */

import { buildEnglishSubjectPrompt } from "./prompts/subject-english.js";
import { buildBrainReportPrompt }   from "./prompts/brain-report.js";

// ============================================================
// Configuration
// ============================================================
const MODEL_PRIMARY  = "gemini-3-flash";
const MODEL_FALLBACK = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// ============================================================
// Custom error
// ============================================================
class GeminiError extends Error {
  constructor(message, { status = null, model = null, raw = null } = {}) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.model = model;
    this.raw = raw;
  }
}

// ============================================================
// Prompt dispatch (future: korean, math, brain)
// ============================================================
function buildPromptFor(type, subject, payload) {
  if (type === "subject") {
    if (subject === "english") return buildEnglishSubjectPrompt(payload);
    // if (subject === "korean") return buildKoreanSubjectPrompt(payload);
    // if (subject === "math")   return buildMathSubjectPrompt(payload);
    throw new Error(`Unknown or unimplemented subject: ${subject}`);
  }
  if (type === "brain") {
    return buildBrainReportPrompt(payload);
  }
  throw new Error(`Unknown or unimplemented report type: ${type}`);
}

// ============================================================
// Gemini call
// ============================================================
async function callGemini(model, apiKey, prompt) {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 3500,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_ONLY_HIGH" },
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
    throw new GeminiError(`Gemini ${model} returned an empty response`, { model, raw: data });
  }
  return text;
}

// ============================================================
// JSON extraction (robust to stray preambles)
// ============================================================
function extractJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace  = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

function clampScore(v, max = 5) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

/** 모델 응답을 표준화. brain 타입은 writingGrades 없음 */
function validateAndNormalize(parsed, type) {
  const result = {
    report: String(parsed?.report || "").trim(),
  };

  if (type === "subject") {
    const grades = parsed?.writingGrades || {};
    const normalizedGrades = {};
    Object.keys(grades).forEach(k => {
      normalizedGrades[k] = {
        score: clampScore(grades[k]?.score, 5),
        feedback: String(grades[k]?.feedback || "").slice(0, 500),
      };
    });
    result.writingGrades = normalizedGrades;
  }

  return result;
}

// ============================================================
// Main handler
// ============================================================
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // GET — health check
    if (request.method === "GET") {
      return json({
        service: "MSAT · Gemini Worker",
        models: { primary: MODEL_PRIMARY, fallback: MODEL_FALLBACK },
        endpoints: [
          "POST /?type=subject&subject=english",
          "POST /?type=subject&subject=korean (pending)",
          "POST /?type=subject&subject=math (pending)",
          "POST /?type=brain (pending)",
        ],
        status: "ok",
      }, 200);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const apiKey = env.GEMINI_KEY;
    if (!apiKey) {
      return json({ error: "GEMINI_KEY is not configured on the Worker" }, 500);
    }

    // Parse query for routing
    const type = url.searchParams.get("type") || "subject";
    const subject = url.searchParams.get("subject") || "english";

    // Parse body
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // Build prompt
    let prompt;
    try {
      prompt = buildPromptFor(type, subject, payload);
    } catch (e) {
      return json({ error: e.message || "Prompt build failed" }, 400);
    }

    // Call Gemini (with fallback)
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
        return json({
          error: "Both Gemini models failed",
          primary: primaryError?.message || null,
          fallback: e2?.message || null,
        }, 502);
      }
    }

    // Parse JSON output
    let parsed;
    try {
      parsed = extractJson(rawText);
    } catch (e) {
      console.error("JSON parse failed:", e.message, "Raw preview:", rawText.slice(0, 500));
      return json({
        error: "Gemini output was not valid JSON",
        detail: e.message,
        rawPreview: rawText.slice(0, 500),
      }, 502);
    }

    const normalized = validateAndNormalize(parsed, type);
    if (!normalized.report) {
      return json({ error: "Gemini produced empty report" }, 502);
    }

    const responseBody = {
      report: normalized.report,
      model: modelUsed,
      type,
      subject,
    };
    if (normalized.writingGrades) {
      responseBody.writingGrades = normalized.writingGrades;
    }

    return json(responseBody, 200);
  },
};

// ============================================================
// Helpers
// ============================================================
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}
