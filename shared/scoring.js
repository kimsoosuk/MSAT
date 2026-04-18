/**
 * MSAT · shared/scoring.js
 * -------------------------------------------------------------------
 * 과목 독립적인 채점 로직. QUESTIONS 배열을 인자로 받아
 * 객관식 자동 채점 + 서술형 AI 점수 반영 + 뇌 영역 활성도 계산.
 *
 * 사용처:
 *   import { computeResult, computeMaxScores } from "../shared/scoring.js";
 *   const max = computeMaxScores(QUESTIONS);
 *   const result = computeResult({ questions: QUESTIONS, answers, writingScores, max });
 * -------------------------------------------------------------------
 */

import {
  REGION_KEYS, WORDS, CORE_W, AUX_W,
  WRITING_POINTS_EACH, TOTAL_POINTS,
  getMcPoints, gradeOf,
} from "./data.js";

// ============================================================
// 각 영역/단어의 만점 (모두 정답일 때 얻을 수 있는 최대 점수)
// ============================================================

/** QUESTIONS 기반으로 영역별·단어별 만점 계산 */
export function computeMaxScores(QUESTIONS) {
  const maxRegion = {};
  REGION_KEYS.forEach(k => (maxRegion[k] = 0));

  const maxWord = {};
  Object.keys(WORDS).forEach(w => (maxWord[w] = 0));

  QUESTIONS.forEach(q => {
    (q.core || []).forEach(w => {
      const r = WORDS[w];
      if (r) {
        maxRegion[r] += CORE_W;
        if (maxWord.hasOwnProperty(w)) maxWord[w] += CORE_W;
      }
    });
    (q.aux || []).forEach(w => {
      const r = WORDS[w];
      if (r) {
        maxRegion[r] += AUX_W;
        if (maxWord.hasOwnProperty(w)) maxWord[w] += AUX_W;
      }
    });
  });

  return { maxRegion, maxWord };
}

// ============================================================
// 뇌 영역 크레딧 누적 헬퍼
// ============================================================

function addRegionCredit(q, credit, regionRaw, wordRaw) {
  if (credit <= 0) return;
  (q.core || []).forEach(w => {
    const r = WORDS[w];
    if (r) {
      regionRaw[r] += CORE_W * credit;
      wordRaw[w] = (wordRaw[w] || 0) + CORE_W * credit;
    }
  });
  (q.aux || []).forEach(w => {
    const r = WORDS[w];
    if (r) {
      regionRaw[r] += AUX_W * credit;
      wordRaw[w] = (wordRaw[w] || 0) + AUX_W * credit;
    }
  });
}

// ============================================================
// 메인 채점 함수
// ------------------------------------------------------------
// params:
//   questions     — 문제 배열
//   answers       — { [n]: "A"|... } 또는 { [n]: { key: text } } (서술형)
//   writingScores — { 29: 0..5, 30: 0..5 } 또는 null (아직 채점 전)
//   max           — { maxRegion, maxWord } — computeMaxScores 결과
// returns:
//   전체 결과 객체 (UI에서 바로 사용 가능한 형태)
// ============================================================

export function computeResult({ questions, answers, writingScores, max }) {
  const regionRaw = {};
  REGION_KEYS.forEach(k => (regionRaw[k] = 0));

  const wordRaw = {};
  Object.keys(WORDS).forEach(w => (wordRaw[w] = 0));

  let mcCorrect = 0;
  let mcPoints = 0;
  let mcPointsMax = 0;
  let writingPointsEarned = 0;
  const perQuestion = {};
  const perSection = {};

  questions.forEach(q => {
    // Section aggregation bucket
    if (!perSection[q.section]) {
      perSection[q.section] = {
        section: q.section,
        totalQ: 0, correctQ: 0,
        pointsEarned: 0, pointsMax: 0,
        mcCorrect: 0, mcTotal: 0,
        writingScore: 0, writingMax: 0,
      };
    }
    const sec = perSection[q.section];

    const ans = answers[q.n];

    if (q.type === "mc") {
      const pts = getMcPoints(q.n);
      mcPointsMax += pts;
      const correct = !!ans && ans === q.answer;

      if (correct) {
        mcCorrect++;
        mcPoints += pts;
        sec.correctQ++;
        sec.mcCorrect++;
        sec.pointsEarned += pts;
      }
      sec.totalQ++;
      sec.mcTotal++;
      sec.pointsMax += pts;

      perQuestion[q.n] = {
        n: q.n,
        type: "mc",
        section: q.section,
        type_code: q.type_code || null,
        type_label: q.type_label || null,
        correct,
        userAnswer: ans || null,
        correctAnswer: q.answer,
        pointsEarned: correct ? pts : 0,
        pointsMax: pts,
      };

      addRegionCredit(q, correct ? 1 : 0, regionRaw, wordRaw);
    } else if (q.type === "writing") {
      const score = (writingScores && typeof writingScores[q.n] === "number")
        ? Math.max(0, Math.min(WRITING_POINTS_EACH, writingScores[q.n]))
        : 0;
      const credit = score / WRITING_POINTS_EACH;
      writingPointsEarned += score;

      const obj = ans || {};
      const attempted = Object.values(obj).some(v => v && String(v).trim().length > 0);

      sec.totalQ++;
      sec.pointsMax += WRITING_POINTS_EACH;
      sec.writingMax += WRITING_POINTS_EACH;
      sec.pointsEarned += score;
      sec.writingScore += score;
      if (score >= WRITING_POINTS_EACH * 0.6) sec.correctQ++;

      perQuestion[q.n] = {
        n: q.n,
        type: "writing",
        section: q.section,
        type_code: q.type_code || null,
        type_label: q.type_label || null,
        attempted,
        userAnswer: ans,
        score,
        pointsEarned: score,
        pointsMax: WRITING_POINTS_EACH,
      };

      addRegionCredit(q, credit, regionRaw, wordRaw);
    }
  });

  // --- 영역별 절대 활성도 (0–100) ---
  const regionAbs = {};
  REGION_KEYS.forEach(k => {
    regionAbs[k] = max.maxRegion[k] > 0
      ? (regionRaw[k] / max.maxRegion[k]) * 100
      : 0;
  });

  // --- 영역별 상대 z-score (학생 자기 기준) ---
  const absValues = Object.values(regionAbs);
  const mean = absValues.reduce((a, b) => a + b, 0) / absValues.length;
  const variance = absValues.reduce((a, b) => a + (b - mean) ** 2, 0) / absValues.length;
  const stdev = Math.sqrt(variance);

  const regionRel = {};
  REGION_KEYS.forEach(k => {
    regionRel[k] = stdev > 0.01 ? (regionAbs[k] - mean) / stdev : 0;
  });

  // --- 하이브리드 점수 (강/약 판정용) ---
  const regionHybrid = {};
  REGION_KEYS.forEach(k => {
    regionHybrid[k] = regionAbs[k] + regionRel[k] * 5;
  });

  const sortedByHybrid = Object.entries(regionHybrid)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const isBalanced = stdev < 8;
  const strongest = sortedByHybrid.slice(0, 2);
  const weakest = sortedByHybrid.slice(-2).reverse();

  // --- 단어별 활성도 (0–1) ---
  const wordIntensity = {};
  Object.keys(WORDS).forEach(w => {
    wordIntensity[w] = max.maxWord[w] > 0 ? (wordRaw[w] / max.maxWord[w]) : 0;
  });

  // --- 총점 & 등급 ---
  const totalPoints = Math.round((mcPoints + writingPointsEarned) * 10) / 10;
  const totalPct = Math.round(totalPoints);
  const grade = gradeOf(totalPct);

  // --- 영역별 반올림 (표시용) ---
  const regionPct = {};
  REGION_KEYS.forEach(k => (regionPct[k] = Math.round(regionAbs[k])));

  // --- 섹션별 요약 마무리 ---
  Object.values(perSection).forEach(sec => {
    sec.pct = sec.pointsMax > 0 ? Math.round((sec.pointsEarned / sec.pointsMax) * 100) : 0;
    sec.pointsEarned = Math.round(sec.pointsEarned * 10) / 10;
  });

  return {
    // MC
    mcCorrect,
    mcTotal: questions.filter(q => q.type === "mc").length,
    mcPoints: Math.round(mcPoints * 10) / 10,
    mcPointsMax,
    mcPct: mcPointsMax > 0 ? Math.round((mcPoints / mcPointsMax) * 100) : 0,

    // Writing
    writingScores: writingScores || {},
    writingPoints: Math.round(writingPointsEarned * 10) / 10,
    writingPointsMax: WRITING_POINTS_EACH * questions.filter(q => q.type === "writing").length,

    // Total
    totalPoints,
    totalPointsMax: TOTAL_POINTS,
    totalPct,
    grade,  // { key, label, min, color, desc }

    // Regions
    regionRaw,
    regionMax: max.maxRegion,
    regionAbs,
    regionPct,
    regionRel,
    regionHybrid,
    regionMean: mean,
    regionStdev: stdev,
    isBalanced,
    strongest,
    weakest,

    // Words
    wordRaw,
    wordIntensity,

    // Per-item
    perQuestion,
    perSection,
  };
}
