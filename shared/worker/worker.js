/**
 * MSAT · shared/worker/worker.js
 * -------------------------------------------------------------------
 * 하나의 Cloudflare Worker가 모든 과목/리포트 타입을 라우팅한다.
 *
 * 모델명:
 *   Primary  : gemini-3-flash-preview
 *   Fallback : gemini-2.5-flash
 * -------------------------------------------------------------------
 */

import { buildEnglishSubjectPrompt } from "./prompts/subject-english.js";
import { buildBrainReportPrompt } from "./prompts/brain-report.js";

// ============================================================
// Configuration
// ============================================================
const MODEL_PRIMARY = "gemini-3-flash-preview";
const MODEL_FALLBACK = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
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
// Prompt dispatch
// ============================================================
function buildPromptFor(type, subject, payload) {
  if (type === "subject") {
    if (subject === "english") return buildEnglishSubjectPrompt(payload);
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
      maxOutputTokens: 8192,
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
    throw new GeminiError(`Gemini ${model} returned an empty response`, { model, raw: data });
  }
  return text;
}

// ============================================================
// Content extraction (Tag-based parsing)
// ============================================================
function extractContent(text) {
  let jsonData = {};
  let reportString = "";
  let sectionNotes = {};

  // 1. JSON 블록 추출 (===JSON_START=== ... ===JSON_END===)
  const jsonMatch = text.match(/===JSON_START===([\s\S]*?)===JSON_END===/);
  if (jsonMatch) {
    let cleaned = jsonMatch[1].trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    try {
      jsonData = JSON.parse(cleaned);
    } catch (err) {
      // 줄바꿈 정제 후 재시도
      try {
        let singleLine = cleaned.replace(/\n/g, " ").replace(/\r/g, "");
        jsonData = JSON.parse(singleLine);
      } catch (e) { /* 실패 시 빈 객체 유지 */ }
    }
  }

  // 2. Section Detail 블록 추출 (===SECTION_DETAIL_START=== ... ===SECTION_DETAIL_END===)
  const sectionMatch = text.match(/===SECTION_DETAIL_START===([\s\S]*?)===SECTION_DETAIL_END===/);
  if (sectionMatch) {
    const sectionText = sectionMatch[1].trim();
    // [SECTION_A] ... [SECTION_B] ... 형식 파싱
    const sectionRegex = /\[SECTION_([A-G])\]([\s\S]*?)(?=\[SECTION_[A-G]\]|$)/g;
    let m;
    while ((m = sectionRegex.exec(sectionText)) !== null) {
      sectionNotes[m[1]] = m[2].trim();
    }
  }

  // 3. Report 블록 추출 (===REPORT_START=== ... ===REPORT_END===)
  const reportMatch = text.match(/===REPORT_START===([\s\S]*?)(?:===REPORT_END===|$)/);
  if (reportMatch) {
    reportString = reportMatch[1].trim();
  } else {
    // 대체 추출 로직
    if (text.includes("===JSON_END===")) {
      reportString = text.split("===JSON_END===")[1].trim();
      // SECTION_DETAIL 블록 제거
      reportString = reportString.replace(/===SECTION_DETAIL_START===([\s\S]*?)===SECTION_DETAIL_END===/, "").trim();
    } else if (jsonData.report) {
      reportString = jsonData.report;
    } else {
      reportString = text.trim();
    }
  }

  return { ...jsonData, report: reportString, sectionNotes };
}

function clampScore(v, max = 5) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function validateAndNormalize(parsed, type) {
  const result = {
    report: String(parsed?.report || "").trim(),
    sectionNotes: parsed?.sectionNotes || {},
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

    // ============================================================
    // DB Routes (Cloudflare D1)
    // ============================================================

    // 1) 학생 업서트 + 결과 저장
    if (request.method === "POST" && url.pathname === "/save-result") {
      if (!env.DB) return json({ error: "DB binding not found" }, 500);
      try {
        const { student, result } = await request.json();

        // 학생 업서트
        await env.DB.prepare(`
          INSERT INTO students (student_id, name, school, grade, dob, last_seen_at)
          VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
          ON CONFLICT(student_id) DO UPDATE SET
            name = excluded.name,
            school = excluded.school,
            grade = excluded.grade,
            last_seen_at = excluded.last_seen_at
        `).bind(
          student.studentId, student.name,
          student.school || null, student.grade || null, student.dob || null
        ).run();

        // 결과 저장
        await env.DB.prepare(`
          INSERT INTO exam_results (
            student_id, subject, version, total_points, grade_label,
            mc_correct, mc_points, writing_points,
            answers_json, writing_grades_json, region_abs_json,
            word_intensity_json, per_section_json, subject_report_md
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        `).bind(
          student.studentId, result.subject, result.version || "2026.04",
          result.totalPoints, result.gradeLabel,
          result.mcCorrect, result.mcPoints, result.writingPoints,
          JSON.stringify(result.answers || {}),
          JSON.stringify(result.writingGrades || {}),
          JSON.stringify(result.regionAbs || {}),
          JSON.stringify(result.wordIntensity || {}),
          JSON.stringify(result.perSection || {}),
          result.subjectReportMd || null
        ).run();

        return json({ ok: true });
      } catch (e) {
        return json({ error: "DB save failed", detail: e.message }, 500);
      }
    }

    // 2) 전체 학생 목록 (관리자용)
    if (request.method === "GET" && url.pathname === "/admin/students") {
      if (!env.DB) return json({ error: "DB binding not found" }, 500);
      // 간단한 Admin Key 체크
      const adminKey = request.headers.get("X-Admin-Key");
      if (env.ADMIN_KEY && adminKey !== env.ADMIN_KEY) {
        return json({ error: "Unauthorized" }, 401);
      }

      try {
        const { results } = await env.DB.prepare(`
          SELECT s.student_id, s.name, s.school, s.grade, s.last_seen_at,
                 GROUP_CONCAT(DISTINCT r.subject) as subjects_completed
          FROM students s
          LEFT JOIN exam_results r ON r.student_id = s.student_id
          GROUP BY s.student_id
          ORDER BY s.last_seen_at DESC
          LIMIT 200
        `).all();
        return json({ students: results });
      } catch (e) {
        return json({ error: "DB query failed", detail: e.message }, 500);
      }
    }

    // 3) 특정 학생 결과 상세 (Brain Report용)
    if (request.method === "GET" && url.pathname.startsWith("/admin/student/")) {
      if (!env.DB) return json({ error: "DB binding not found" }, 500);
      const adminKey = request.headers.get("X-Admin-Key");
      if (env.ADMIN_KEY && adminKey !== env.ADMIN_KEY) {
        return json({ error: "Unauthorized" }, 401);
      }

      const studentId = url.pathname.split("/").pop();
      try {
        const { results } = await env.DB.prepare(`
          SELECT subject, total_points, grade_label, submitted_at,
                 mc_correct, mc_points, writing_points,
                 answers_json, writing_grades_json,
                 region_abs_json, word_intensity_json, per_section_json,
                 subject_report_md
          FROM exam_results
          WHERE student_id = ?1
          ORDER BY submitted_at DESC
        `).bind(studentId).all();

        // 과목별 최신 하나씩만 정리
        const latest = {};
        for (const r of results) {
          if (!latest[r.subject]) {
            latest[r.subject] = {
              ...r,
              regionAbs: JSON.parse(r.region_abs_json || "{}"),
              wordIntensity: JSON.parse(r.word_intensity_json || "{}"),
              perSection: JSON.parse(r.per_section_json || "{}"),
              answers: JSON.parse(r.answers_json || "{}"),
              writingGrades: JSON.parse(r.writing_grades_json || "{}"),
            };
          }
        }
        return json({ subjects: latest });
      } catch (e) {
        return json({ error: "DB query failed", detail: e.message }, 500);
      }
    }

    // 4) 기본 상태 체크 (GET /)
    if (request.method === "GET" && url.pathname === "/") {
      return json({
        service: "MSAT · Gemini Worker",
        models: { primary: MODEL_PRIMARY, fallback: MODEL_FALLBACK },
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

    const type = url.searchParams.get("type") || "subject";
    const subject = url.searchParams.get("subject") || "english";

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    let prompt;
    try {
      prompt = buildPromptFor(type, subject, payload);
    } catch (e) {
      return json({ error: e.message || "Prompt build failed" }, 400);
    }

    let modelUsed = MODEL_PRIMARY;
    let rawText;
    let primaryError = null;

    try {
      rawText = await callGemini(MODEL_PRIMARY, apiKey, prompt);
    } catch (e) {
      primaryError = e;
      try {
        modelUsed = MODEL_FALLBACK;
        rawText = await callGemini(MODEL_FALLBACK, apiKey, prompt);
      } catch (e2) {
        return json({
          error: "Both Gemini models failed",
          primary: primaryError?.message || null,
          fallback: e2?.message || null,
        }, 502);
      }
    }

    let parsed;
    try {
      parsed = extractContent(rawText);
    } catch (e) {
      return json({
        error: "Gemini output format was invalid",
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
    if (normalized.sectionNotes && Object.keys(normalized.sectionNotes).length > 0) {
      responseBody.sectionNotes = normalized.sectionNotes;
    }

    return json(responseBody, 200);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}
